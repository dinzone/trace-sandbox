# Tracer-sandbox

This project is writen to understand tracing with jaeger.

## workflow

There are 3 services:  
1. http server that have 2 routes
2. micro service `A` that connect to rabbitmq and process messages that come from the http server.
3. another micro service `B` that connect to rabbit and recive message from service `A` and process the message.  

**Diagram workflow**:  
```
        _____________   send message   _____________    send message   _____________
       | http server | -------------> | service 'A' | --------------> | service 'B' |
       |_____________|                |_____________|                 |_____________| 

```

### http-handler

The http handler has 2 routes:  
1. `/error` - will return 500 and report to jaeger that the span failed.
2. `/trace` - will start the workflow that mentioned above.

### processing-services

This service will load `A` or `B` service by the argument sent to the process.  
`A` service recive message with trace `carrier` from the `http-handler`, parse it, "process" the message and send it to service `B`.  
`B` service recive message from `A` service and do basically the same.  

### links

To understand more about tracing and jaeger, i recomend to read from here:  
[opentracing data model](https://github.com/opentracing/specification/blob/master/specification.md)  
[opentracing example in js](https://opentracing.io/guides/javascript/)  
[jaeger docs](https://www.jaegertracing.io/docs/1.17/)  
[jaeger nodejs packege](https://github.com/jaegertracing/jaeger-client-node)  
[jaeger good example with nodejs,express and rabbit](https://epsagon.com/blog/distributed-tracing-through-rabbitmq-using-node-js-jaeger/)