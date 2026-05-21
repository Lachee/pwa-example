import {connect} from './modules/printer.js'

let connection = null;

document.getElementById('connect').addEventListener('click', async () => {
    connection = await connect();
    connection.onDisconnect = () => {
        console.log('Disconnected');
        connection = null;
    }
})

document.getElementById('disconnect').addEventListener('click', () => {
    if (connection) {
        connection.disconnect();
    }
})

document.getElementById('feed').addEventListener('click', async () => {
    if (!connection) return;
    await connection.feed();
})