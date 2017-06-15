import config from '../../client-config'
import axios from 'axios'
import Rx from 'rx-lite'

export const getXeroContacts$ = Rx.Observable.create(observer => {
  axios.get(`${config.apiBase}/api/xero/contacts`)
    .then(res => {
      observer.onNext(res.data)
      observer.onCompleted()
    })
    .catch(err => observer.onError(err))
})

export const getXeroContact$$ = (contactId) => {
  return Rx.Observable.create(observer => {
    axios.get(`${config.apiBase}/api/xero/contacts/${contactId}`)
      .then(res => {
        observer.onNext(res.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

/*
  contact = {
    Name: 'Johnnies Coffee',
    FirstName: 'John',
    LastName: 'Smith',
  }
*/
export const createXeroContact$$ = (contact) => {
  return Rx.Observable.create(observer => {
    axios.post(`${config.apiBase}/api/xero/contacts`, contact)
      .then(res => {
        observer.onNext(res.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

export const updateXeroContact$$ = (contactId, updateContact) => {
  return Rx.Observable.create(observer => {
    axios.put(`${config.apiBase}/api/xero/contacts?contactId=${contactId}`, updateContact)
      .then(res => {
        observer.onNext(res.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}
