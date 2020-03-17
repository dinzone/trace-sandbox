import amqplib from 'amqplib';

let instance: RabbitHandler;

class RabbitHandler {
    private url: string;
    private connection!: amqplib.Connection;
    private channel!: amqplib.Channel;
    constructor(url: string = 'localhos:5672') {
        this.url = `amqp://${url}`;
    }
    async connect(): Promise<void> {
        this.connection = await amqplib.connect(this.url);
        this.channel = await this.connection.createChannel();
        this.channel.prefetch(1, true);
        return;
    }
    async produce(queueName: string, message: object): Promise<void> {
        await this.channel.assertQueue(queueName);
        await this.channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)));
        return
    }
    async consume(queueName: string, logic: ((message: object) => Promise<void>)) {
        await this.channel.assertQueue(queueName);
        await this.channel.consume(queueName, async (msg: amqplib.ConsumeMessage | null) => {
            try {
                let messageToLogic = JSON.parse(msg?.content.toString() || '');
                await logic(messageToLogic);
                await this.channel.ack(msg as amqplib.Message);
            } catch (err) {
                await this.channel.nack(msg as amqplib.Message);
            }
            finally {
                return Promise.resolve();
            }
        });
    }
}

export default function getInstance(urlConnection?: string): RabbitHandler {
    if (!instance) {
        return instance = new RabbitHandler(urlConnection);
    }
    return instance;
}