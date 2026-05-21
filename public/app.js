import {connect} from './modules/printer.js'
import {dither, canvasToBitmap} from './modules/picture.js'

let connection = null;

const btnConnect = document.getElementById('connect');
const btnDisconnect = document.getElementById('disconnect');
const btnPrint = document.getElementById('print');
const btnFeed = document.getElementById('feed');
const inputImage = document.getElementById('input_image');
const canvas = document.getElementById('canvas');
const progress = document.getElementById('progress');


function onDisconnect() {
    btnConnect.disabled = false;
    btnDisconnect.disabled = true;
    btnFeed.disabled = true;
    btnPrint.disabled = true;
    progress.value = 0;
    connection = null;
}

function onConnect() {
    btnConnect.disabled = true;
    btnDisconnect.disabled = false;
    btnFeed.disabled = false;
    btnPrint.disabled = false;
}

onDisconnect();

btnConnect.addEventListener('click', async () => {
    connection = await connect();
    console.log('Connected');
    onConnect();

    connection.onDisconnect = () => {
        console.log('Disconnected');
        onDisconnect();
    }

    // Just a bit of noise to know we're connected'
    await connection.feed(1);
})

btnDisconnect.addEventListener('click', () => {
    if (connection) {
        connection.disconnect();
    }
})

btnFeed.addEventListener('click', async () => {
    if (!connection) return;
    await connection.feed(3);
})

btnPrint.addEventListener('click', async () => {
    if (!connection) return;
    const bitmap = canvasToBitmap(canvas);
    await connection.printBitmap(bitmap, (percent) => {
        document.getElementById('progress').value = percent * 100;
    });
    await connection.feed();
    document.getElementById('progress').value = 100;
});

inputImage.addEventListener('change', async (e) => {
    console.log(e.target.files[0]);
    const uploadedImage = await new Promise(resolve => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            const img = new Image();
            img.onload = () => {
                resolve(img)
            }
            img.src = e.target.result;
        }
        reader.readAsDataURL(file);
    });

    const ctx = canvas.getContext('2d');

    const scale = canvas.width / uploadedImage.width;
    canvas.height = Math.floor(uploadedImage.height * scale);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(uploadedImage, 0, 0, canvas.width, canvas.height);

    dither(canvas);
})