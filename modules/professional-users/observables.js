import Rx from 'rx-lite'
import R from 'ramda'
import axios from 'axios'
import config from '../../client-config'

export const saveProfessionalUserToDB$$ = profile => {
  return Rx.Observable.create(observer => {
    axios.post(`${config.apiBase}/api/professional-users`, profile)
      .then(userObj => {
        // console.log('userObj', userObj)
        observer.onNext(userObj.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

export const checkProfessionalUserExistsInDB$$ = email => {
  const encondedEmail = encodeURIComponent(email)
  return Rx.Observable.create(observer => {
    axios.get(`${config.apiBase}/api/professional-users?userEmail=${encondedEmail}`)
      .then(userObj => {
        if (R.isEmpty(userObj.data)) {
          observer.onNext(false)
        } else {
          observer.onNext(true)
        }
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

export const getProfessionalUserFromDB$$ = email => {
  const encondedEmail = encodeURIComponent(email)
  return Rx.Observable.create(observer => {
    axios.get(`${config.apiBase}/api/professional-users?userEmail=${encondedEmail}`)
      .then(userObj => {
        observer.onNext(userObj.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

export const deleteProfessionalUserInDB$$ = email => {
  const encondedEmail = encodeURIComponent(email)
  return Rx.Observable.create(observer => {
    axios.delete(`${config.apiBase}/api/professional-users?userEmail=${encondedEmail}`)
      .then(userObj => {
        observer.onNext(userObj.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

export const updateProfessionalUserInDB$$ = (email, updateObj) => {
  const encondedEmail = encodeURIComponent(email)
  return Rx.Observable.create(observer => {
    axios.put(`${config.apiBase}/api/professional-users?userEmail=${encondedEmail}`, updateObj)
      .then(dbRes => {
        // console.log('dbRes', dbRes)
        observer.onNext(dbRes.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

export const getProfessionalUserByReferralCodeFromDB$$ = referralCode => {
  return Rx.Observable.create(observer => {
    axios.get(`${config.apiBase}/api/professional-users/referral/${referralCode}`)
      .then(userObj => {
        observer.onNext(userObj.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

export const checkReferralCodeExistsInDB$$ = referralCode => {
  return Rx.Observable.create(observer => {
    if (R.isEmpty(referralCode)) {
      // if referralCode is empty, return an empty string
      observer.onNext('')
      observer.onCompleted()
    }

    axios.get(`${config.apiBase}/api/professional-users/referral/${referralCode}`)
      .then(userObj => {
        if (R.isEmpty(userObj.data)) {
          observer.onNext(false)
        } else {
          observer.onNext(true)
        }
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

// Takes an array of possible referral codes and returns an available one
export const getAvailableReferralCode$$ = referralCodes => {
  /*
    payload = {
      referralCodes: ['SLEE', 'SELEE', 'SEULEE', 'SLEEX', 'SELEEX', 'SEULEEX']
    }
    returns = 'SELEEX'
  */
  const referralCodesPayload = {referralCodes}

  return Rx.Observable.create(observer => {
    axios.post(`${config.apiBase}/api/professional-users/referral/check`, referralCodesPayload)
      .then(referralCodeObj => {
        /*
          returns: {
            referralCode: 'SELEEX'
          }
        */
        console.log('referralCodeObj in server', referralCodeObj)
        observer.onNext(R.prop('data', referralCodeObj))
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

export const updateProfessionalUserReferralCreditInDB$$ = (email, updateObj) => {
  const encondedEmail = encodeURIComponent(email)
  return Rx.Observable.create(observer => {
    axios.put(`${config.apiBase}/api/professional-users?userEmail=${encondedEmail}&referralCreditUpdate=true`, updateObj)
      .then(dbRes => {
        // console.log('dbRes', dbRes)
        observer.onNext(dbRes.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}

export const setFreeSampleAlreadySent$$ = email => {
  const encondedEmail = encodeURIComponent(email)
  const updateObj = {
    metadata: {
      freeSampleAlreadySent: true
    }
  }
  return Rx.Observable.create(observer => {
    axios.put(`${config.apiBase}/api/professional-users?userEmail=${encondedEmail}`, updateObj)
      .then(dbRes => {
        observer.onNext(dbRes.data)
        observer.onCompleted()
      })
      .catch(err => observer.onError(err))
  })
}
