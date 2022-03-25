require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const client = require('twilio')(
  process.env.ACCOUNT_SID,
  process.env.AUTH_TOKEN
);
getExistingQueues()

async function getExistingQueues() {//Go get existing Queues
  client.taskrouter.workspaces(process.env.TR_WORKSPACE_SID)
    .taskQueues
    .list()
    .then(taskQueues => {
      sortQueuesWorkflows(taskQueues)
    });
}

function loadCSV(existingQueues, existingWorkflows) { //Let's load the CSV
  let queuesToLoad = [];
  fs.createReadStream(process.argv.slice(2)[0])
    .pipe(csv())
    .on('data', (data) => {
      queuesToLoad.push(data);
    })
    .on('end', () => {
      sortTaskQueue(queuesToLoad, existingQueues, existingWorkflows);

    });
}



async function sortQueuesWorkflows(taskQueues) {
  let existingWorkflows = []; //Build Array for the existing Queues
  let existingQueues = [];
  for (let i = 0; i < taskQueues.length; i++) {
    let singleQueue = {}
    let name = taskQueues[i].friendlyName
    singleQueue[name] = taskQueues[i].sid
    existingQueues.push(singleQueue)
  }

  await client.taskrouter.workspaces(process.env.TR_WORKSPACE_SID) //Get existing Workflows
    .workflows
    .list()
    .then(workflows => {
      for (let i = 0; i < workflows.length; i++) {//Build Array for existing Workflows
        existingWorkflows.push(workflows[i].friendlyName)
      }

    });
  loadCSV(existingQueues, existingWorkflows)
}

function sortTaskQueue(queuesToLoad, existingQueues, existingWorkflows) {
  let uniqueWorkflows = [];
  let existingQueueNames = [];
  let newQueueNames = [];
  let queuesToUpdate = [];
  let queuesToCreate = [];
  for (let i = 0; i < existingQueues.length; i++) { //Build Array for existing Queue names
    existingQueueNames.push(Object.keys(existingQueues[i])[0])
  }
  for (let j = 0; j < queuesToLoad.length; j++) { //Build Array for Queue names to load
    newQueueNames.push(queuesToLoad[j].QueueFriendlyName)
    if (existingQueueNames.indexOf(queuesToLoad[j].QueueFriendlyName) === -1) { //Check for new Queue
      queuesToCreate.push(queuesToLoad[j].QueueFriendlyName)

    } else {
      queuesToUpdate.push(queuesToLoad[j].QueueFriendlyName) //Check for existing Queue
    }
  }
  for (let k = 0; k < queuesToLoad.length; k++) { //Build Array for existing Queue names
    if (uniqueWorkflows.indexOf(queuesToLoad[k].WorkflowName) == -1) {
      uniqueWorkflows.push(queuesToLoad[k].WorkflowName)
    }

  }
  console.log("List loaded, we have", queuesToCreate.length, "new Queues, ", queuesToUpdate.length, " Queues to update and", uniqueWorkflows.length, "Workflows to process")
  filterQueues(queuesToUpdate, queuesToCreate, queuesToLoad, existingQueues, existingWorkflows, uniqueWorkflows)
}

function filterQueues(queuesToUpdate, queuesToCreate, queuesToLoad, existingQueues, existingWorkflows, uniqueWorkflows) {
  let filteredCreateList = []
  let filterUpdateList = []
  for (let i = 0; i < queuesToLoad.length; i++) { //Build Array for existing Queue names
    if (queuesToCreate.indexOf(queuesToLoad[i].QueueFriendlyName) > -1) {
      filteredCreateList.push(queuesToLoad[i])
    }
  }
  for (let j = 0; j < queuesToLoad.length; j++) { //Build Array for existing Queue names
    if (queuesToUpdate.indexOf(queuesToLoad[j].QueueFriendlyName) > -1) {
      let test1 = queuesToLoad[j]
      for (let k = 0; k < existingQueues.length; k++) { //Go get the sid for the Queue name
        if (queuesToLoad[j].QueueFriendlyName == Object.keys(existingQueues[k])[0]) {
          test1.sid = Object.values(existingQueues[k])[0]
        }
      }
      filterUpdateList.push(test1)
    }
  }
  createQueues(filterUpdateList, filteredCreateList, existingWorkflows, uniqueWorkflows, queuesToLoad)
}

async function createQueues(filterUpdateList, filteredCreateList, existingWorkflows, uniqueWorkflows, queuesToLoad) { //Create new Queues
  for (let i = 0; i < filteredCreateList.length; i++) {
    await waitforme(1000);
    await client.taskrouter.workspaces(process.env.TR_WORKSPACE_SID)
      .taskQueues
      .create({
        targetWorkers: filteredCreateList[i].QueueExpression,
        friendlyName: filteredCreateList[i].QueueFriendlyName,
      })
      .then(task_queue => {
        console.log("Created", filteredCreateList[i].QueueFriendlyName)
        filteredCreateList[i].sid = task_queue.sid
    })
      .catch(error => { //Let's make some meaningful error messages
        switch (error.code) {
          case 20001:
            console.log(filteredCreateList[i].QueueFriendlyName, "exists", JSON.stringify(error));
            break;
          case 20429:
            console.log("Throttling, too many requests", JSON.stringify(error));
            break;
          default:
            console.log(JSON.stringify(error));
        }
      });
  }
  updateQueues(filterUpdateList, filteredCreateList, existingWorkflows, uniqueWorkflows, queuesToLoad)

}

async function updateQueues(filterUpdateList, filteredCreateList, existingWorkflows, uniqueWorkflows, queuesToLoad) { //Update existing queues
  for (let i = 0; i < filterUpdateList.length; i++) {
    await waitforme(1000);
    await client.taskrouter.workspaces(process.env.TR_WORKSPACE_SID)
      .taskQueues(filterUpdateList[i].sid)
      .update({ targetWorkers: filterUpdateList.QueueExpression })
      .then(task_queue => console.log("Updated", task_queue.friendlyName))
      .catch(error => {
        switch (error.code) { //Let's make some meaningful error messages
          case 20001:
            console.log(filteredCreateList[i].QueueFriendlyName, "exists", JSON.stringify(error));
            break;
          case 20429:
            console.log("Throttling, too many requests", JSON.stringify(error));
            break;
          default:
            console.log(JSON.stringify(error));
        }
      })
  }
  console.log(filteredCreateList)
  configureWorkflows(existingWorkflows, uniqueWorkflows, queuesToLoad)
}


function waitforme(milisec) { // Let's throttle a bit
  return new Promise(resolve => {
    setTimeout(() => { resolve('') }, milisec);
  })
}

async function configureWorkflows(existingWorkflows, uniqueWorkflows, queuesToLoad) {

  console.log(queuesToLoad)

  let filters = [];
  let workflowProperties = [];
  for (let i = 0; i < uniqueWorkflows.length; i++) { // Build Array for the filters
    await waitforme(1000);

    if (existingWorkflows.indexOf(uniqueWorkflows[i]) > -1) { //Check if Workflow exists
      console.log(uniqueWorkflows[i], "exists, preparing to update") //Workflow exists, update it
      workflowProperties = [];
      filters = [];
      for (let j = 0; j < queuesToLoad.length; j++) {

        if (queuesToLoad[j].WorkflowName == uniqueWorkflows[i]) {

          workflowProperties.push(queuesToLoad[j])
          filters.push({
            friendlyName: queuesToLoad[j].QueueFriendlyName,
            expression: queuesToLoad[j].WorkflowFilter,
            targets: [{ queue: queuesToLoad[j].sid }],
          })
        }
      }

      await client.taskrouter.workspaces(process.env.TR_WORKSPACE_SID)
        .workflows
        .list()
        .then(workflows => {
          for (let k = 0; k < workflows.length; k++) {//Build Array for existing Workflows
            if (workflows[k].friendlyName == uniqueWorkflows[i]) {
              let workflowToUpdate = workflows[k].sid
              client.taskrouter.workspaces(process.env.TR_WORKSPACE_SID)
                .workflows(workflowToUpdate)
                .update({
                  configuration: JSON.stringify({
                    task_routing: {
                      filters,
                      default_filter: { queue: process.env.TR_DEFAULT_TASKQUEUE_SID }
                    }
                  })
                })
                .then(workflow => console.log(workflow.friendlyName, "updated"))
                .catch(error => {
                  switch (error.code) { //Let's make some meaningful error messages
                    case 20001:
                      console.log(filteredCreateList[i].QueueFriendlyName, "exists", JSON.stringify(error));
                      break;
                    case 20429:
                      console.log("Throttling, too many requests", JSON.stringify(error));
                      break;
                    default:
                      console.log(JSON.stringify(error));
                  }
                })
            }
          }

        });
    } else { //Workflow doesn't exist, create it
      console.log("Creating", uniqueWorkflows[i])
      workflowProperties = [];
      filters = [];
      for (let j = 0; j < queuesToLoad.length; j++) {
        if (queuesToLoad[j].WorkflowName == uniqueWorkflows[i]) {
          workflowProperties.push(queuesToLoad[j])
          filters.push({
            friendlyName: queuesToLoad[j].QueueFriendlyName,
            expression: queuesToLoad[j].WorkflowFilter,
            targets: [{ queue: queuesToLoad[j].sid }]
          })
          console.log("Filter is",queuesToLoad[j].sid)
        }
      }

      

      await client.taskrouter
        .workspaces(process.env.TR_WORKSPACE_SID)
        .workflows.create({
          friendlyName: uniqueWorkflows[i],
          configuration: JSON.stringify({
            task_routing: {
              filters,
              default_filter: { queue: process.env.TR_DEFAULT_TASKQUEUE_SID }
            }
          }),
        });

    }
  }
}