const OPTIONAL_SERVICES = [
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000af30-0000-1000-8000-00805f9b34fb',
    '000018f0-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    '00006e40-cc97-450a-9f4b-7030610a1271'
];

const log = (...args) => console.log(...args);

export async function connect(filter = true) {
    if (!('bluetooth' in navigator))
        throw new Error('Bluetooth not supported by this browser');

    log('Searching for devices...');
    const bleDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: !filter,
        filters: filter ? [{
            namePrefix: 'Y',
        }] : undefined,
        optionalServices: OPTIONAL_SERVICES
    });

    const server = await bleDevice.gatt.connect();

    log('Discovering services...')
    let printCharacteristic = null;
    const services = await server.getPrimaryServices();
    for (let service of services) {
        try {
            const characteristics = await service.getCharacteristics();
            ``
            for (let char of characteristics) {
                if (char.properties.write || char.properties.writeWithoutResponse) {
                    log('Service characteristic discovered', service.uuid, char.uuid);
                    printCharacteristic = char;
                    break;
                }
            }
        } catch (e) {
            continue;
        }
        if (printCharacteristic) break;
    }

    if (!printCharacteristic)
        throw new Error("Writable characteristic not discovered.");

    const connection = {
        device: bleDevice,
        onDisconnect: function () {
            log('Disconnected');
            printCharacteristic = null;
        },
        send: async function (raw) {
            if (!printCharacteristic)
                throw new Error("Printer not connected");

            if (printCharacteristic.properties.writeWithoutResponse) {
                await printCharacteristic.writeValueWithoutResponse(raw);
            } else {
                await printCharacteristic.writeValue(raw);
            }
        },
        disconnect: function () {
            this.device.gatt.disconnect();
        },
        feed: async function () {
            // ESC @ = reset printer
            // ESC d 3 = feed 3 lines
            // ESC J 80 = feed 80 dots
            await this.send(
                new Uint8Array([
                    0x1b, 0x40,
                    0x1b, 0x64, 0x03,
                    0x0a,
                    0x0a,
                    0x0a,
                    0x1b, 0x4a, 0x50
                ]));
        },
        printBitmap: async function (data, width, height, progress = undefined) {
            // We send the ESC/POS header just ONCE for the entire image block
            const byteWidth = width / 8; // 384 / 8 = 48
            const header = [
                0x1d, 0x76, 0x30, 0x00,          // GS v 0 0
                byteWidth & 0xff, (byteWidth >> 8) & 0xff,
                height & 0xff, (height >> 8) & 0xff
            ];

            // Combine the header and the raw image bytes
            const fullPayload = new Uint8Array([...header, ...data]);

            // DRIP-FEED ENGINE
            // We send data in chunks of 100 bytes. This is small enough to fit inside
            // standard Bluetooth LE packets, but large enough to be efficient.
            const CHUNK_SIZE = 100;

            for (let i = 0; i < fullPayload.length; i += CHUNK_SIZE) {
                const chunk = fullPayload.slice(i, i + CHUNK_SIZE);

                if (printCharacteristic.properties.writeWithoutResponse) {
                    await printCharacteristic.writeValueWithoutResponse(chunk);
                } else {
                    await printCharacteristic.writeValue(chunk);
                }

                // Update UI Progress
                if (progress) {
                    const percent = Math.min(1, ((i + CHUNK_SIZE) / fullPayload.length));
                    progress(percent);
                }
                // CRITICAL FIX: 25ms delay.
                // This creates a pacing "speed limit". It prevents the browser from
                // shoving data into the printer's 4KB memory buffer faster than it
                // can physically turn on the heating elements and burn the paper.
                await new Promise(resolve => setTimeout(resolve, 25));
            }
        }
    }

    bleDevice.addEventListener('gattserverdisconnected', () => connection.onDisconnect());
    return connection;
}
