export default interface ServiceInterface {
    start(msg: object): Promise<void>;
}