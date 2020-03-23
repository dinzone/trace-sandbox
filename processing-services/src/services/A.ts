import serviceInterface from './serviceInterface';
import { Tracer, ReferenceTypes, BaggageFormat } from '../../../utils/TracerRS';
import { wait } from '../../../utils';
import getInstance from '../../../utils/rabbitmq';

const rabbit = getInstance();

class Service implements serviceInterface {
    async start(msg: any): Promise<void> {
        const tracer: Tracer = new Tracer();
        let parentSpan;
        try {
            console.log('do some work');
            if (msg.tracerCarrier) {
                parentSpan = Tracer.extract(msg.tracerCarrier, BaggageFormat.TEXT_MAP);
            }
            tracer.startSpan('A-processing', parentSpan, ReferenceTypes.FOLLOWS_FROM);
            tracer.spanLog({
                msg: 'start A processing'
            });
            console.log(`got message: ${JSON.stringify(msg)}`);
            wait(2500);
            tracer.spanLog({
                msg: 'finish A processing'
            });
            console.log('finish A logic');
            tracer.startSpan('send-message-to-B', tracer.activeSpan(), ReferenceTypes.FOLLOWS_FROM);
            await rabbit.produce('B', msg);
            tracer.finishAll();
            return Promise.resolve();
        } catch (err) {
            console.log(err);
            throw err;
        }
    }
}

export default new Service();