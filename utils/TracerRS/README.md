# TracerRS

This package provide jaeger-tracer and opentracing managment system.

## Table of Contents

1. [install](#install)
2. [basic usage](#basic-usage)
3. [classes](#classes)
    1. [Tracer](#tracer)
        1. [initTracer](#inittracer)
        2. [inject](#inject)
        3. [extract](#extract)
        4. [startSpan](#tracerstartspan)
        5. [spanLog](#tracerspanlog)
        6. [spanError](#tracerspanerror)
        7. [spanTag](#tracerspantag)
        8. [spanSetError](#tracerspanseterror)
        9. [context](#tracercontext)
        10. [finish](#tracerfinish) 
        11. [finishAll](#tracerfinishall)
        12. [setName](#tracersetname)
        13. [withSpan](#tracerwithspan)
        14. [withTracer](#tracerwithtracer)
        15. [activeSpan](#traceractivespan)
        16. [rootSpan](#tracerrootspan)
    2. [Span](#span)
        1. [startSpan](#spanstartspan)
        2. [log](#spanlog)
        3. [error](#spanerror)
        4. [tag](#spantag)
        5. [setError](#spanseterror)
        6. [context](#spancontext)
        7. [finish](#spanfinish)
        8. [setName](#spansetname)
        9. [getInternalSpan](#spangetinternalspan)
        10. [getTracer](#spangettracer)
        11. [getParent](#spangetparent)
4. [enums](#enums)
___

### install

TODO: publish package and add install description

### basic usage

To use the tracer you must init it using `initTracer` before you can create instances of the tracer.  
```js
import { Tracer } from 'TracerRS';

// before starting using tracer
Tracer.initTracer(config,options);
```
___
```js
function startService(){
    // now you can create instance of tracer.
    // if you don't init the tracer before, error will thrown
    const tracer = new Tracer();
    
    tracer.startSpan('my-span');
    tracer.spanLog('start some logic'); // add message log to the span
    try {
        someLogic();
    }catch(err) {
        tracer.spanError(err, true); // add error log + set the opentracing Error tag to true
    }finally {
        tracer.finish();
    }
}

startService();
```
___
## Classes

The pacakge provide 2 main classes that you can use.
1. `Tracer`
2. `Span`  

As every tracing package work, here only the `Tracer` can create spans, and on `Span` you can add logs and tags.

## Tracer

The Tracer class is the main class you should use, it do like any other tracer do as `opentracing` declare, but it also manage your spans and add another suger functions to make your code less verbose and more clean.  
you can see basic usage in the `basic usage` section.  

### initTracer

```ts
static Tracer.initTracer(config?: TracingConfig, options?: TracingOptions): void
```
init the global tracer that connect with jaeger agent, must called before creating any instances of the `Tracer` class.

`config` (optional) - jaeger tracer config  
`options` (optional) - jaeger tracer options  
for more info about this two params see [here](https://www.npmjs.com/package/jaeger-client)

### inject
```ts
static Tracer.inject(span: Span, format?: BaggageFormat): Object
```
return `carrier` given span and format.  
this is to transfer the span context between processes.

### extract
```ts
static extract(baggage: any, format: BaggageFormat): SpanContext | undefined | null;
```
extract span context from the `carrier` that was injected by the `Tracer.inject` method.  
in case the `carrier` not valid it might return `undefined` or `null`.

### tracer.startSpan
```ts
startSpan(spanName: string, parentSpan?: Span | SpanContext | null, reference: ReferenceTypes = ReferenceTypes.CHILD_OF): Span
```
start new span, in case its the first span in the tracer, it will create it as root span, else it will create child/follow span from the current active span of the tracer.

### tracer.spanLog
```ts
spanLog(object: { [key: string]: any }): Span;
// OR
spanLog(message: string): Span;
```
add log to the active span, if the parameter is an object, it will log it as is.
in case the parameter is string, it will log in format of:
```json
{
    "message":"value_of_parameter"
}
```

### tracer.spanError
```ts
spanError(error: Error, setErrorToTrue?: boolean = false): Span
```
add error log to the active span, in jaeger spans there isn't error log, but in this method it will add to the active span log object that paresd from the `error`.  
```json
{
    "error.name": "name of the error",
    "error.message": "the error message",
    "error.stack": "the error stack"
}
```
in case `setErrorToTrue` is `true`, it will also add to span tags, the `Error` tag.

### tracer.spanTag
```ts
spanTag(object: { [key: string]: any }): Span
// OR
spanTag(key: string, value: string | number | boolean): Span;
```
add one or more tags to the active span,  
in case the first parameter is an object, it will tag it as is.  
in case the first parameter is `string`, the second parameter is required and tag the active span tag:
```json
{
    "key":"value"
}
```
### tracer.spanSetError
```ts
spanSetError(isError?: boolean = true): Span
```
add `Error` tag to span with `isError` as its value, default to `true`.

### tracer.context
```ts
context(): SpanContext
```
return the active span context

### tracer.finish
```ts
finish(finishChildren?: boolean = false): void
```
finish the active span, then make the parent of the span as the new active span, in case there is no parent to the span, the active span will be `undefined`.  
in that case use `tracer.activeSpan` to change it, or `tracer.startSpan` to create new root span.  
in case `finishChildren` is `true`, it will finish all span children as well.

### tracer.finishAll
```ts
finishAll(): void
```
will finish all span that created from the root span, and the root span as well.

### tracer.setName
```ts
setName(spanName: string): Span
```
set the operation name of the active span

### tracer.withSpan
```ts
withSpan(span: Span, func: (...params: any[]) => Promise<any>, ...params: any[]): Promise<any>
```
this will wrap function with given span, it inject the span to the function scope, and then you can use the span in the given function.  
the wrap will automaticly add `Error` tag when the function fail and finish the span when the function finish.  
**important** do not call the function directly, wrap it with Arrow function so the scope of the function will not break.  
example:
```js
function myMethod(params){
    // get the active span here
    const span = this.activeSpan();
    span.log('before stuff1');
    doStuff1(params);
    span.log('after stuff1');
    span.log('before stuff2');
    doStuff1(params);
    span.log('after stuff2');
    span.tag('foo','bar');
}


// assume you init the tracer
const tracer = new Tracer();
const mySpan = tracer.startSpan('my-root-span');
// in case of error, the 'Error' tag will add automatic.
tracer.withSpan(mySpan,
                (params)=>myMethod(params),
                parameters);
// the withSpan method will finish the span authomatic, so you dont need to handle it
```

### tracer.withTracer
```ts
withTracer(span: Span, func: (...params: any[]) => Promise<any>, ...params: any[])
```
**this is experimental method!!!**  
like `tracer.withSpan` but will inject new instance of tracer that its root span is the `span` that provide in the method.

### tracer.activeSpan
```ts
activeSpan(span: Span): Span
// OR
activeSpan(): Span
```
get or set the active span.  
example:
```js
const tracer = new Tracer();
const rootSpan = tracer.startSpan('root');
tracer.activeSpan(); // return rootSpan
const childSpan = tracer.startSpan('child'); // will be child of rootSpan
tracer.activeSpan(child); // set activeSpan
tracer.activeSpan(); // return childSpan
tracer.finish(); // finish childSpan
tracer.activeSpan(); // return rootSpan
tracer.finish();
tracer.activeSpan(); // return undefined
```

### tracer.rootSpan
```ts
rootSpan(): Span
```
return the root span

## Span

Span class is like jaeger span class, it has start and end time, tags and logs.  
this class is wrap with more convinece API.  
example:
```js
const tracer = new Tracer();
const mySpan = tracer.startSpan('some-name');
mySpan.log('hi'); // add logs to the span
mySpan.tag('thisIs','greate');
mySpan.finish();
```

### span.startSpan
```ts
startSpan(name: string, reference?: ReferenceTypes): Span
```
start new child/follow span from the span.

### span.log
```ts
log(object: { [key: string]: any }): Span
// OR
log(message: string): Span
```
add log to span, if the parameter is an object, it will log it as is.  
in case the parameter is string, it will log in format of:
```json
{
    "message":"value_of_parameter"
}
```

### span.error
```ts
error(error: Error, setErrorToTrue?: boolean = false): Span
```
add error log to span, in jaeger spans there isn't error log, but in this method it will add to the active span log object that paresd from the `error`.  
```json
{
    "error.name": "name of the error",
    "error.message": "the error message",
    "error.stack": "the error stack"
}
```
in case `setErrorToTrue` is `true`, it will also add to span tags, the `Error` tag.

### span.tag
```ts
spanTag(object: { [key: string]: any }): Span
// OR
spanTag(key: string, value: string | number | boolean): Span;
```
add one or more tags to span,  
in case the first parameter is an object, it will tag it as is.  
in case the first parameter is `string`, the second parameter is required and tag the active span tag:
```json
{
    "key":"value"
}
```

### span.setError
```ts
spanSetError(isError?: boolean = true): Span
```
add `Error` tag to span with `isError` as its value, default to `true`.

### span.context
```ts
context(): SpanContext
```
return the span context

### span.finish
```ts
finish(finishChildren?: boolean = false): void
```
finish the span.
in case `finishChildren` is `true`, it will finish all span children as well.

### span.setName
```ts
setName(spanName: string): Span
```
set the operation name of the span

### span.getInternalSpan
```ts
getInternalSpan(): openTracingSpan
```
return the jaeger span

### span.getTracer
```ts
getTracer(): Tracer
```
return the tracer that responsible for the span

### span.getParent
```ts
getParent(): Span | undefined
```
return the span parent if exist

## enums
There are 2 enums that used by the package:  

### BaggageFormat
use for the `inject` & `extract` methods.
```ts
enum BaggageFormat {
    HTTP_HEADERS,
    TEXT_MAP,
    BINARY
}
```

### ReferenceTypes
use to declere the reference between spans.
```ts
enum ReferenceTypes {
    CHILD_OF,
    FOLLOWS_FROM
}
```
