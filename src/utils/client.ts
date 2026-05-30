import "dotenv/config.js"
import * as lark  from '@larksuiteoapi/node-sdk'


const client = new lark.Client({
	appId: process.env.FEISHU_APP_ID || "",
	appSecret: process.env.FEISHU_APP_SECRET|| "",
	// disableTokenCache为true时，SDK不会主动拉取并缓存token，这时需要在发起请求时，调用lark.withTenantToken("token")手动传递
	// disableTokenCache为false时，SDK会自动管理租户token的获取与刷新，无需使用lark.withTenantToken("token")手动传递token
	disableTokenCache: false
});

const wsClient = new lark.WSClient({
	appId: process.env.FEISHU_APP_ID || "",
	appSecret: process.env.FEISHU_APP_SECRET|| ""
});



export function getClient(){
    return client
}


export function getWsClient(){
    return wsClient
}

