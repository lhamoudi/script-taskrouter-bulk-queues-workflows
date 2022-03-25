# TaskRouter Bulk Queues and Workflows Script

## Overview
This Node.JS script is designed for bulk creating and updating Twilio TaskRouter TaskQueues and Workflows, as well as bulk deleting TaskQueues that are not associated with any Workflows.

It currently supports a very simple Workflow routing configuration of targeting a single TaskQueue in one routing step per Workflow filter, and configuring the default TaskQueue per Workflow.

## Setup
1. Clone the repository and run `npm install`
1. Copy `env.sample` to `.env`
1. Update the following variables in `.env` for the Twilio account to be updated
    * **ACCOUNT_SID**
    * **AUTH_TOKEN**
    * **TR_WORKSPACE_SID** (TaskRouter Workspace SID)
    * **TR_DEFAULT_TASKQUEUE_SID** (TaskRouter TaskQueue SID for Workflow default queue)
1. Update the `my-data.csv` file with the desired TaskQueue and Workflow information, or create your own CSV with these same headers. See the [Twilio TaskQueue](https://www.twilio.com/docs/taskrouter/api/task-queue) and [Twilio Workflow](https://www.twilio.com/docs/taskrouter/workflow-configuration) documentation for more details on these fields.
    * **QueueFriendlyName** (TaskQueue Friendly Name)
    * **QueueExpression** (TaskQueue Queue Expression)
    * **WorkflowName** (Workflow Friendly Name)
    * **WorkflowFilter** (Workflow Filter Expression)

## Running the Script

### Creating or Updating TaskQueues and Workflows
To create or update TaskQueues and Workflows using the information defined in the CSV file created during Setup, run the following terminal command, replacing `my-data.csv` with the name of the desired CSV file.

```sh
node createupdate my-data.csv
```

The script will parse the CSV file and create or update TaskQueues and Workflows as necessary. The script is rate limited to one request per second to keep within Twilio TaskRouter API limits for POST requests to the TaskQueue and Workflow endpoints.

### Deleting Unused TaskQueues
To delete any TaskQueues that are not referenced in any workflows, run the following terminal command.

```sh
node delete
```