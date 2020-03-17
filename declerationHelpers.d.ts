import { Span } from "opentracing";

declare global {
    namespace Express {
        export interface Request {
            span?: Span
        }
    }
}