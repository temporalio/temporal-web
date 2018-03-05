const
  request = require('supertest'),
  Long = require('long'),
  dateToLong = d => Long.fromValue(Number(new Date(d))).mul(1000000000)

describe('Listing Workflows', function() {
  const demoExecThrift = {
    execution: {
      workflowId: 'demo',
      runId: 'd92bb92c-5f49-487f-80a8-f8f375ba55a8'
    },
    type: {
      name: 'github.com/uber/cadence/demo.cronWorkflow'
    },
    startTime: dateToLong(1510349400),
    closeTime: null,
    closeStatus: null,
    historyLength: null
  },
  demoExecJson = Object.assign({}, demoExecThrift, {
    startTime: '2017-11-10T21:30:00.000Z',
  })

  it('should list open workflows', function() {
    this.test.ListOpenWorkflowExecutions = ({ listRequest }) => {
      listRequest.domain.should.equal('canary')
      listRequest.StartTimeFilter.earliestTime.div(1000000000).toNumber().should.equal(1510488000)
      listRequest.StartTimeFilter.latestTime.div(1000000000).toNumber().should.equal(1510583400)
      should.not.exist(listRequest.executionFilter)
      should.not.exist(listRequest.typeFilter)
      return {
        executions: [demoExecThrift],
        nextPageToken: new Buffer('opentoken')
      }
    }

    return request(global.app)
      .get('/api/domain/canary/workflows/open?startTime=2017-11-12T12:00:00Z&endTime=2017-11-13T14:30:00Z')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect({
        executions: [demoExecJson],
        nextPageToken: 'b3BlbnRva2Vu'
      })
  })

  it('should list closed workflows', function() {
    this.test.ListClosedWorkflowExecutions = ({ listRequest }) => {
      listRequest.domain.should.equal('canary')
      listRequest.StartTimeFilter.earliestTime.div(1000000000).toNumber().should.equal(1510488000)
      listRequest.StartTimeFilter.latestTime.div(1000000000).toNumber().should.equal(1510583400)
      should.not.exist(listRequest.executionFilter)
      should.not.exist(listRequest.typeFilter)
      return {
        executions: [demoExecThrift],
        nextPageToken: new Buffer('closetoken')
      }
    }

    return request(global.app)
      .get('/api/domain/canary/workflows/closed?startTime=2017-11-12T12:00:00Z&endTime=2017-11-13T14:30:00Z')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect({
        executions: [demoExecJson],
        nextPageToken: 'Y2xvc2V0b2tlbg=='
      })
  })

  it('should forward the next page token along', function() {
    this.test.ListClosedWorkflowExecutions = ({ listRequest }) => {
      listRequest.nextPageToken.toString().should.equal('page1')
      return {
        executions: [],
        nextPageToken: new Buffer('page2')
      }
    }

    return request(global.app)
      .get('/api/domain/canary/workflows/closed?startTime=2017-11-01&endTime=2017-11-13T22:27:17.551Z&nextPageToken=cGFnZTE=')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect({
        executions: [],
        nextPageToken: 'cGFnZTI='
      })
  })

  it('should return 404 if another state of workflows is queried', function() {
    return request(global.app)
      .get('/api/domain/canary/workflows/failed')
      .expect(404)
  })

  it('should return 400 if startTime or endTime are missing', async function() {
    await request(global.app)
      .get('/api/domain/canary/workflows/open?startTime=2017-11-01')
      .expect(400)

    return request(global.app)
      .get('/api/domain/canary/workflows/closed?endTime=2017-11-01')
      .expect(400)
  })
})

describe('Describe Domain', function() {
  it('should describe the domain', async function () {
    const domainInfo = {
      name: 'test-domain',
      status: 'REGISTERED',
      description: 'ci test domain'
    }

    this.test.DescribeDomain = ({ describeRequest }) => {
      describeRequest.name.should.equal('test-domain')
      return { domainInfo }
    }

    return request(global.app)
      .get('/api/domain/test-domain')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect(Object.assign({ ownerEmail: null }, domainInfo))
  })

  it('should return 404 if the domain is not found', async function () {
    this.test.DescribeDomain = ({ describeRequest }) => ({
      ok: false,
      body: { message: `domain "${describeRequest.name}" does not exist`},
      typeName: 'entityNotExistError'
    })

    return request(global.app)
      .get('/api/domain/nonexistant')
      .expect(404)
      .expect('Content-Type', /json/)
      .expect({
        message: 'domain "nonexistant" does not exist'
      })
  })
})