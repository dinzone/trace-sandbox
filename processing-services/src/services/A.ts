import serviceInterface from './serviceInterface';
import TracerRS, { spanRefType } from '../../../utils/tracer';
import { FORMAT_TEXT_MAP } from 'opentracing';
import { wait } from '../../../utils';
import getInstance from '../../../utils/rabbitmq';

const rabbit = getInstance();

class Service implements serviceInterface {
    async start(msg: any): Promise<void> {
        let parentSpan;
        try {
            console.log('do some work');
            if (msg.tracerCarrier) {
                parentSpan = TracerRS.tracer?.extract(FORMAT_TEXT_MAP, msg.tracerCarrier)
            }
            const span = TracerRS.startSpan('A-processing', parentSpan, spanRefType.REFERENCES);
            span?.log({
                msg: 'start A processing'
            });
            console.log(`got message: ${JSON.stringify(msg)}`);
            wait(2500);
            span?.log({
                msg: 'finish A processing'
            });
            console.log('finish A logic');
            span?.finish();
            const rabbitSpan = TracerRS.startSpan('send-message-to-B', span?.context(), spanRefType.REFERENCES);
            await rabbit.produce('B', msg);
            rabbitSpan?.finish();
            return Promise.resolve();
        } catch (err) {
            console.log(err);
            throw err;
        }
    }
}

export default new Service();