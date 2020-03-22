import { Span } from "./utils/TracerRS";

declare global {
    namespace Express {
        export interface Request {
            span?: Span
        }
    }
}