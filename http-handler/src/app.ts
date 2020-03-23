import { config as dotenv } from 'dotenv';
dotenv();

import express from 'express';

import TracerRS, { spanRefType } from '../../utils/tracer';

import { wait } from '../../utils';

import { default as getRabbitInstance } from '../../utils/rabbitmq';
import { Tags, Span, FORMAT_TEXT_MAP, REFERENCE_CHILD_OF } from 'opentracing';

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

app.get('/tracePlus', async (req, res) => {
    const tracer = new TracerRS(); // create tracer
    tracer.startSpan('name'); // start root span of request
    tracer.log('hello'); // when start root span the tracer reference to it
    tracer.tag('hi', 'bye');
    // create to child spans of the root span
    const spanRef1 = tracer.startSpan('a', tracer.activeSpan(), REFERENCE_CHILD_OF),
        spanRef2 = tracer.startSpan('b', tracer.activeSpan(), REFERENCE_CHILD_OF);
    // bind the two span to funcion
    // after the functions finish the spans finish too
    await Promise.all([
        tracer.withSpan(spanRef1, someIO, 3000),
        tracer.withSpan(spanRef2, someIO, 2000)
    ]);
    tracer.log('bye'); // still reference to root span
    const spanRef3 = tracer.startSpan('c', tracer.currentSpan(), REFERENCE_CHILD_OF); // create new child span
    tracer.activeSpan(spanRef3); // change the active span, now every method that will call in tracer will reference to 'spanRef3'
    tracer.tag('type', 'c');
    tracer.log('change span');
    wait(2000);
    tracer.activeSpan(tracer.rootSpan()); // change back the active span to root span
    tracer.log('finish request');
    tracer.finishAll(); // finish all span tree
    res.send(true);
});

start();

async function start() {
    await rabbit.connect();
    app.listen(3000, () => {
        console.log('server running on port 3000');
    });
}

function someIO(this: any, num: number): Promise<void> {
    let self = this;
    self.activeSpan().log('start');
    self.activeSpan().tag({
        ms: num
    });
    return new Promise((res, rej) => {
        setTimeout(() => {
            self.activeSpan().log('end');
            res();
        }, num);
    });
}