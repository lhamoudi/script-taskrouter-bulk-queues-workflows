require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const client = require('twilio')(
    process.env.ACCOUNT_SID,
    process.env.AUTH_TOKEN
);
let existingQueues = []
client.taskrouter.workspaces(process.env.TR_WORKSPACE_SID)
    .taskQueues
    .list()
    .then(taskQueues => {
        getExistingQueues(taskQueues)
    });

function getExistingQueues(taskQueues) {
    let existingQueues = []
    for (let i = 0; i < taskQueues.length; i++) {
        existingQueues.push(taskQueues[i].sid)
    }
    deleteQueues(existingQueues)
}

async function deleteQueues(existingQueues) {
    for (let i = 0; i < existingQueues.length; i++) {
        await waitforme(500);

        await client.taskrouter.workspaces(process.env.TR_WORKSPACE_SID)
            .taskQueues(existingQueues[i])
            .remove()
            .then(task_queue => console.log("Deleted", existingQueues[i]))
            .catch(error => {
                switch (error.code) {
                    case 20001:
                        console.log("This is part of a Workflow", JSON.stringify(error));
                        break
                    case 20429:
                        console.log("Throttling, too many requests", JSON.stringify(error));
                        break;
                    default:
                        console.log(JSON.stringify(error));
                }
            })
    }
}

function waitforme(milisec) {
    return new Promise(resolve => {
        setTimeout(() => { resolve('') }, milisec);
    })
}