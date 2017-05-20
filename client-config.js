import {__ENV__} from './modules/global/constants'

let clientConfig

if (__ENV__ === 'production') {
  const host = 'https://zensaskincare.com'
  const serverHost = 'https://zensa.herokuapp.com'
  const serverPort = process.env.PORT || 9000
  const apiBase = serverHost
  clientConfig = {
    host,
    serverHost,
    serverPort,
    apiBase
  }
} else {
  const host = 'http://127.0.0.1'
  const port = 8000
  const serverHost = 'http://127.0.0.1'
  const serverPort = process.env.PORT || 9000
  const apiBase = serverHost + ':' + serverPort
  clientConfig = {
    host,
    port,
    serverHost,
    serverPort,
    apiBase
  }
}

export default clientConfig
