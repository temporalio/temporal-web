import parentWorkflowLink from './parent-workflow-link';

describe('parentWorkflowLink', () => {
  describe('When passed wfStartDetails.parentWorkflowExecution', () => {
    let wfStartDetails;

    beforeEach(() => {
      wfStartDetails = {
        parentWorkflowNamespace: 'parentWorkflowNamespaceValue',
        parentWorkflowExecution: {
          workflowId: 'workflowIdValue',
          runId: 'runIdValue',
        },
      };
    });

    it('should return an object with to.name.', () => {
      const output = parentWorkflowLink(wfStartDetails);

      expect(output.to.name).toEqual('workflow/summary');
    });

    it('should return an object with to.params.namespace.', () => {
      const output = parentWorkflowLink(wfStartDetails);

      expect(output.to.params.namespace).toEqual('parentWorkflowNamespaceValue');
    });

    it('should return an object with to.params.workflowId.', () => {
      const output = parentWorkflowLink(wfStartDetails);

      expect(output.to.params.workflowId).toEqual('workflowIdValue');
    });

    it('should return an object with to.params.runId.', () => {
      const output = parentWorkflowLink(wfStartDetails);

      expect(output.to.params.runId).toEqual('runIdValue');
    });

    it('should return an object with text.', () => {
      const output = parentWorkflowLink(wfStartDetails);

      expect(output.text).toEqual('workflowIdValue');
    });
  });
});
