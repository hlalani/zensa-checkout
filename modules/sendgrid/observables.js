import config from '../../client-config'
import axios from 'axios'
import Rx from 'rx-lite'

/*
  payload = {
    toEmailArray: [{email: SUPPORT_EMAIL}],
    fromEmail: {email},
    subject: '[Support Request] Customer support request from Zensaskincare.com',
    content: `Use: ${usage}\n\nMessage: ${body}`
  }
*/

export const sendEmail$$ = payload => {
  return Rx.Observable.create(observer => {
    axios({
      url: config.apiBase + '/api/sendgrid/send',
      method: 'post',
      headers: {
        'content-type': 'application/json'
      },
      data: payload
    })
      .then(res => {
        observer.onNext(res)
        observer.onCompleted()
      })
      .catch(err => observer.onError())
  })
}
