import { config as dotenv } from 'dotenv';
dotenv();

import express from 'express';

import TracerRS, { spanRefType } from '../../utils/tracer';

import { wait } from '../../utils';

import { default as getRabbitInstance } from '../../utils/rabbitmq';
import { Tags, FORMAT_TEXT_MAP } from 'opentracing';

import { default as config } from '../../utils/config';

import { Tracer, ReferenceTypes } from '../../utils/TracerRS';

const rabbit = getRabbitInstance(config.RABBIT_URL);

Tracer.initTracer({
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

const appTracer = new Tracer();

app.use(appTracer.injectSpanMiddleware());

app.get('/error', async (req, res) => {
    const { span } = req;
    span?.setName('error-operation');
    try {
        span?.log('start error route');
        throw new Error('errorrrrrr');
    } catch (err) {
        console.log(err);
        span?.error(err, true);
        span?.tag({
            [Tags.HTTP_STATUS_CODE]: 500
        });
        res.status(500).send('error');
    }
});

app.get('/trace', async (req, res) => {
    const { span: opSpan } = req;
    const tracer = new Tracer();
    opSpan?.setName('long-operation');
    let httpHandlerSpan, rabbitSendSpan;
    try {
        httpHandlerSpan = tracer.startSpan('http-handle-request', opSpan);
        httpHandlerSpan.log('start request handling');
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