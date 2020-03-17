import { config as dotenv } from 'dotenv';
dotenv();

import serviceInterface from './services/serviceInterface';

import { default as getRabbitInstance } from '../../utils/rabbitmq';
import { default as config } from '../../utils/config';

import TracerRS from '../../utils/tracer';

TracerRS.init({
    serviceName: `process-service-${process.argv[2]}`,
    reporter: {
        agentHost: config.JAEGER_AGENT_HOST
    }
}, {
    tags: {
        version: '1.0.0'
    }
});

const rabbit = getRabbitInstance(config.RABBIT_URL);

async function start() {
    const dynamicService = await import(`./services/${process.argv[2]}`);
    const service: serviceInterface = dynamicService.default;
    console.log('connect to rabbit');
    await rabbit.connect();
    console.log('connected to rabbit');
    await rabbit.consume(process.argv[2], service.start);
}

start();