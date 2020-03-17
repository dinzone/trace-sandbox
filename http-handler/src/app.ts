import { config as dotenv } from 'dotenv';
dotenv();

import express from 'express';

import TracerRS, { spanRefType } from '../../utils/tracer';

import { wait } from '../../utils';

import { default as getRabbitInstance } from '../../utils/rabbitmq';
import { Tags, Span, FORMAT_TEXT_MAP } from 'opentracing';

import { default as config } from '../../utils/config';

const rabbit = getRabbitInstance(config.RABBIT_URL);

TracerRS.init({
    serviceName: 'http-handler',
    reporter: {
        agentHost: config.JAEGER_AGENT_HOST
    }
}, {
    tags: {
        version: '1.0.0'
    }
});

const app = express();

app.use(TracerRS.injectSpanMiddleware());

app.get('/error', (req, res) => {
    const { span } = req;
    try {
        span?.log({
            msg: 'start error route'
        });
        throw new Error('errorrrrrr');
    } catch (err) {
        console.log(err);
        TracerRS.error(err);
        span?.addTags({
            [Tags.HTTP_STATUS_CODE]: 500
        });
        res.status(500).send('error');
    }
});

app.get('/trace', async (req, res) => {
    const { span: opSpan } = req;
    let httpHandlerSpan, rabbitSendSpan;
    try {
        httpHandlerSpan = TracerRS.startSpan('http-handle-request', opSpan?.context(), spanRefType.CHILD_OF);
        httpHandlerSpan?.log({
            msg: 'start request handling'
        });
        // simulate logic
        wait(2000);
        httpHandlerSpan?.log({
            msg: 'finish handle request'
        });
        httpHandlerSpan?.finish();
        rabbitSendSpan = TracerRS.startSpan('send-message-to-rabbit', httpHandlerSpan?.context(), spanRefType.REFERENCES);
        let carrier = {};
        TracerRS.tracer?.inject(opSpan!.context(), FORMAT_TEXT_MAP, carrier);
        await rabbit.produce('A', { tracerCarrier: carrier });
        res.status(200).send(true);
    } catch (err) {
        opSpan?.setTag(Tags.ERROR, true);
        res.status(500).send('Internal Server Error');
    } finally {
        rabbitSendSpan?.finish();
    }
});

start();

async function start() {
    await rabbit.connect();
    app.listen(3000, () => {
        console.log('server running on port 3000');
    });
}