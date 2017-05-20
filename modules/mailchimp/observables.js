import config from '../../client-config'
import axios from 'axios'
import Rx from 'rx-lite'

export const subscribeNewMember$$ = (listId, payload) => {
  return Rx.Observable.create(observer => {
    axios.post(`${config.apiBase}/api/mailchimp/lists/${listId}/members`, payload)
      .then(res => {
        observer.onNext(res)
        observer.onCompleted()
      })
      .catch(err => observer.onError())
  })
}

export const getMember$$ = (listId, email) => {
  const encodedEmail = encodeURIComponent(email)
  return Rx.Observable.create(observer => {
    axios.get(`${config.apiBase}/api/mailchimp/lists/${listId}/members/${encodedEmail}`)
      .then(res => {
        observer.onNext(res)
        observer.onCompleted()
      })
      .catch(err => observer.onError())
  })
}

export const deleteMember$$ = (listId, email) => {
  const encodedEmail = encodeURIComponent(email)
  return Rx.Observable.create(observer => {
    axios.delete(`${config.apiBase}/api/mailchimp/lists/${listId}/members/${encodedEmail}`)
      .then(res => {
        observer.onNext(res)
        observer.onCompleted()
      })
      .catch(err => observer.onError())
  })
}
