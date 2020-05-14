const fetch = require('node-fetch');
const GET = 'GET';
const POST = 'POST';
const PUT = 'PUT';

class HttpService {

    static postRequest(url, data, headers) {
        return new Promise(async(resolve,reject)=>{
            try{
                if(!headers){
                    headers = {"Content-Type": "application/json"};
                }
                const result = await this.httpRequest(POST, url, data, headers)
                return resolve(result);
            }catch(e){
                return reject(e);
            }
        });
    };

    static getRequest(url, data, headers) {
        return new Promise(async(resolve,reject)=>{
            try{
                const result = await this.httpRequest(GET, url, data, headers)
                return resolve(result);
            }catch(e){
                return reject(e);
            }
        });
    };

    static putRequest(url, data, headers) {
        return new Promise(async(resolve,reject) => {
            try{
                const result = await this.httpRequest(PUT, url, data, headers)
                return resolve(result);
            }catch(e){
                return reject(e);
            }
        });
    };
    
    static httpRequest(method, url, data, headers={}) {
        return new Promise(async(resolve,reject)=>{
            const options={
                body: data,
                method: method,
                headers: headers
            };
            fetch(url, options).then((res) => {
                return resolve(res);
            }).catch(e => {
                return reject(e)
            });
        })
    }
}

module.exports = HttpService;