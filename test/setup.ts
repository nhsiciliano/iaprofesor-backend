import fetch, { Headers, Request, Response } from 'node-fetch';

global.fetch = fetch as any;
global.Headers = Headers as any;
global.Request = Request as any;
global.Response = Response as any;
