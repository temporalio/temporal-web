const grpc = require('grpc');
const bluebird = require('bluebird');
const protoLoader = require('@grpc/proto-loader');
const Long = require('long');
const losslessJSON = require('lossless-json');
const moment = require('moment');

function buildHistory(getHistoryRes) {
  const history = getHistoryRes.history;

  history.events = getHistoryRes.history.events.map((e) => {
    let attr = '';

    if (e.eventType) {
      attr = e.eventType.toLowerCase().replace(/\_\w/g, function(v) {
        return v.toUpperCase();
      });
      attr = attr.replace(/\_/g, '');
      attr = attr.replace(/EventType/i, '') + 'EventAttributes';
      attr = attr.charAt(0).toLowerCase() + attr.slice(1);
    }

    let details;

    if (e[attr]) {
      details = JSON.parse(JSON.stringify(e[attr]), function replacer(
        key,
        value
      ) {
        if (value && value.type && value.type === 'Buffer') {
          return Buffer.from(value)
            .toString()
            .replace(/["]/g, '')
            .trim();
        }

        return value;
      });
    }

    return {
      timestamp: e.timestamp,
      eventType: e.eventType,
      eventId: e.eventId,
      details,
    };
  });

  return history;
}

function buildWorkflowExecutionRequest(execution) {
  const req = { workflowId: execution.workflowId };

  if (execution.runId) {
    req.runId = Buffer.from(execution.runId);
  }

  return req;
}

function buildStatusFilter(statusFilter) {
  if (!statusFilter) {
    return statusFilter;
  }

  const filter =
    statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1).toLowerCase();

  return { status: filter };
}

function uiTransform(item) {
  if (!item || typeof item !== 'object') {
    return item;
  }

  Object.entries(item).forEach(([subkey, subvalue]) => {
    if (subvalue && typeof subvalue.unsigned === 'boolean') {
      item[subkey] = Long.fromValue(subvalue).toNumber();
      const m = moment(item[subkey] / 1000000);

      if (m.isValid() && m.isAfter('2017-01-01')) {
        item[subkey] = m.toISOString();
      }
    } else if (Buffer.isBuffer(subvalue)) {
      if (subkey === 'nextPageToken') {
        item.nextPageToken = subvalue.toString('base64');

        return;
      }

      const stringval = subvalue.toString('utf8');

      try {
        // most of Temporal's uses of buffer is just line-delimited JSON.
        item[subkey] = stringval
          .split('\n')
          .filter((x) => x)
          .map(JSON.parse);

        if (item[subkey].length === 1) {
          item[subkey] = item[subkey][0];
        }
      } catch (e) {
        item[`${subkey}_base64`] = subvalue.toString('base64');
        item[subkey] = stringval;
      }
    } else if (Array.isArray(subvalue)) {
      subvalue.forEach(uiTransform);
    }
    if (typeof subvalue == 'string') {
      subvalue = enumTransform(subvalue);
      item[subkey] = subvalue;
    } else if (subvalue && typeof subvalue === 'object') {
      uiTransform(subvalue);
    }
  });
  return item;
}

function enumTransform(item) {
  const enumPrefixes = [
    'workflow_execution_status',
    'event_type_workflow_execution',
    'event_type_decision_task',
    'event_type_activity_task',
    'task_queue_kind',
    'continue_as_new_initiator',
    'event_type_timer',
    'timeout_type',
    'archival_status',
    'retry_status',
  ];

  const itemL = item.toLowerCase();
  prefix = enumPrefixes.find((e) => itemL.startsWith(e));

  if (!prefix) {
    return item;
  }

  let processed = itemL.replace(new RegExp(`^${prefix}`), '');
  processed = processed.replace(/\_\w/g, function(v) {
    return v[1].toUpperCase();
  });
  return processed;
}

function cliTransform(item) {
  if (!item || typeof item !== 'object') {
    return item;
  }

  Object.entries(item).forEach(([subkey, subvalue]) => {
    if (subvalue && typeof subvalue.unsigned === 'boolean') {
      item[subkey] = new losslessJSON.LosslessNumber(
        Long.fromValue(subvalue).toString()
      );
    } else if (Buffer.isBuffer(subvalue)) {
      item[subkey] = subvalue.toString('base64');
    } else if (Array.isArray(subvalue)) {
      subvalue.forEach(cliTransform);
    } else if (subvalue && typeof subvalue === 'object') {
      cliTransform(subvalue);
    } else if (subvalue === null || subvalue === undefined) {
      delete item[subkey];
    }
  });

  return item;
}

function WorkflowClient() {
  const dir = process.cwd();
  const protoFileName = 'service.proto';
  const options = {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [
      `${dir}/temporal-proto/`,
      `${dir}/temporal-proto/temporal/common/v1`,
      `${dir}/temporal-proto/temporal/decision/v1`,
      `${dir}/temporal-proto/temporal/enums/v1`,
      `${dir}/temporal-proto/temporal/errordetails/v1`,
      `${dir}/temporal-proto/temporal/execution/v1`,
      `${dir}/temporal-proto/temporal/failure/v1`,
      `${dir}/temporal-proto/temporal/filter/v1`,
      `${dir}/temporal-proto/temporal/history/v1`,
      `${dir}/temporal-proto/temporal/namespace/v1`,
      `${dir}/temporal-proto/temporal/query/v1`,
      `${dir}/temporal-proto/temporal/replication/v1`,
      `${dir}/temporal-proto/temporal/taskqueue/v1`,
      `${dir}/temporal-proto/temporal/version/v1`,
      `${dir}/temporal-proto/temporal/workflow/v1`,
      `${dir}/temporal-proto/temporal/workflowservice/v1`,
    ],
  };

  const packageDefinition = protoLoader.loadSync(protoFileName, options);
  const service = grpc.loadPackageDefinition(packageDefinition);

  let client = new service.temporal.workflowservice.v1.WorkflowService(
    process.env.TEMPORAL_GRPC_ENDPOINT || '127.0.0.1:7233',
    grpc.credentials.createInsecure()
  );

  client = bluebird.promisifyAll(client);
  this.client = client;
}

WorkflowClient.prototype.describeNamespace = async function({ name }) {
  const req = { name };

  const res = await this.client.describeNamespaceAsync(req);

  return uiTransform(res);
};

WorkflowClient.prototype.listNamespaces = async function({
  pageSize,
  nextPageToken,
}) {
  const req = { pageSize, nextPageToken };

  const res = await this.client.listNamespacesAsync(req);

  return uiTransform(res);
};

WorkflowClient.prototype.openWorkflows = async function({
  namespace,
  startTimeFilter,
  typeFilter,
  executionFilter,
  nextPageToken,
  maximumPageSize = 100,
}) {
  const req = {
    namespace,
    startTimeFilter,
    typeFilter,
    executionFilter,
    nextPageToken,
    maximumPageSize,
  };
  const res = await this.client.listOpenWorkflowExecutionsAsync(req);

  return uiTransform(res);
};

WorkflowClient.prototype.closedWorkflows = async function({
  namespace,
  startTimeFilter,
  typeFilter,
  executionFilter,
  statusFilter,
  nextPageToken,
  maximumPageSize = 100,
}) {
  const req = {
    namespace,
    startTimeFilter,
    typeFilter,
    executionFilter,
    statusFilter: buildStatusFilter(statusFilter),
    nextPageToken,
    maximumPageSize,
  };

  const res = await this.client.listClosedWorkflowExecutionsAsync(req);

  return uiTransform(res);
};

WorkflowClient.prototype.listWorkflows = async function({
  namespace,
  query,
  nextPageToken,
  pageSize = 20,
  maximumPageSize = 100,
}) {
  const req = {
    namespace,
    query,
    nextPageToken,
    pageSize,
    maximumPageSize,
  };

  const res = await this.client.listWorkflowExecutionsAsync(req);

  return uiTransform(res);
};

WorkflowClient.prototype.getHistory = async function({
  namespace,
  nextPageToken,
  execution,
  waitForNewEvent,
  maximumPageSize = 100,
}) {
  const req = {
    namespace,
    nextPageToken,
    execution: buildWorkflowExecutionRequest(execution),
    waitForNewEvent,
    maximumPageSize,
  };

  const res = await this.client.getWorkflowExecutionHistoryAsync(req);

  if (res.history && res.history.events) {
    res.history = buildHistory(res);
  }

  return uiTransform(res);
};

WorkflowClient.prototype.archivedWorkflows = async function({
  namespace,
  nextPageToken,
  query,
  pageSize = 100,
}) {
  const req = {
    namespace,
    nextPageToken,
    query,
    pageSize,
  };

  const res = await this.client.listArchivedWorkflowExecutionsAsync(req);

  return uiTransform(res);
};

WorkflowClient.prototype.exportHistory = async function({
  namespace,
  execution,
  nextPageToken,
}) {
  const req = {
    namespace,
    execution: buildWorkflowExecutionRequest(execution),
    nextPageToken,
  };

  const res = await this.client.getWorkflowExecutionHistoryAsync(req);

  return cliTransform(res);
};

WorkflowClient.prototype.queryWorkflow = async function({
  namespace,
  execution,
  query,
}) {
  const req = {
    namespace,
    execution: buildWorkflowExecutionRequest(execution),
    query,
  };
  const res = await this.client.queryWorkflowAsync(req);

  return uiTransform(res);
};

WorkflowClient.prototype.terminateWorkflow = async function({
  namespace,
  execution,
  reason,
}) {
  const req = {
    namespace,
    workflowExecution: buildWorkflowExecutionRequest(execution),
    reason,
  };

  const res = await this.client.terminateWorkflowExecutionAsync(req);

  return uiTransform(res);
};

WorkflowClient.prototype.signalWorkflow = async function({
  namespace,
  execution,
  signal,
}) {
  const req = {
    namespace,
    workflowExecution: buildWorkflowExecutionRequest(execution),
    signal,
  };

  const res = await this.client.signalWorkflowExecutionAsync(req);

  return uiTransform(res);
};

WorkflowClient.prototype.describeWorkflow = async function({
  namespace,
  execution,
}) {
  const req = {
    namespace,
    execution: buildWorkflowExecutionRequest(execution),
  };

  const res = await this.client.describeWorkflowExecutionAsync(req);

  return uiTransform(res);
};

WorkflowClient.prototype.describeTaskQueue = async function({
  namespace,
  taskQueue,
  taskQueueType,
}) {
  const req = { namespace, taskQueue, taskQueueType };
  const res = await this.client.describeTaskQueueAsync(req);

  return uiTransform(res);
};

module.exports = WorkflowClient;
