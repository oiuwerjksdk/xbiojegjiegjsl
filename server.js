const fs = require('fs')
const axios = require('axios')
const express = require('express')
const app = express()
let database = require('./public/database.json')
let subscriptions = require('./subscriptions.json')
let temp = {}


app.use(express.static('public'))
app.get('/subs', (req, res) => res.send(subscriptions))
app.get('/timeslots', (req, res) => routeTimeslots(req, res))
app.get('/subscribe', (req, res) => routeSubscribe(req, res))
app.get('/unsubscribe', (req, res) => routeUnsubscribe(req, res))


app.listen(3000, () => {
  console.log(`Server is running on port 3000...`)
  iterate()
  updateDB()
})


setInterval(function() {
  axios('https://terminhub.onrender.com/')
    .then(res => res)
    .catch(err => err)
}, 12000)


setInterval(function() {
  axios('https://terminhub.onrender.com/')
    .then(res => res)
    .catch(err => err)
}, 41000)


function iterate() {
  const IDs = Object.keys(subscriptions)
  let index = 0
  IDs.length ? check() : setTimeout(iterate, 1000)

  async function check() {
    if (index == IDs.length) {
      console.log('all done')
      iterate()
      return
    }
    const id = IDs[index]
    if (!subscriptions[id]) {
      index++
      check()
      return
    }
    index++
    setTimeout(check, 1000)
    try {
      const data = await getTimeslots(id)
      const name = data.name.slice(0, 60)
      let counter = 0
      for (property in data.timeslots) {
        data.timeslots[property].forEach(el => {
          el.isAvailable ? counter++ : 0
        })
      }
      console.log(counter, name, ':', subscriptions[data.id])
      if (counter > 1) {
        const subject = `${name} има нови термини`
        const plain = `${name} има нови термини: https://terminhub.onrender.com/timeslots.html?id=${id}`
        subscriptions[id].forEach(el => {
          // console.log('mock send email', el.email, subject, plain)
          sendMaileroo(el.email, subject, plain)
        })
        delete subscriptions[id]
        fs.writeFileSync('./subscriptions.json', JSON.stringify(subscriptions))
      }
    } catch (err) {
      console.log(err.message, id)
    }
  }
}


async function getTimeslots(id) {
  if (!temp[id] || Date.now() - temp[id].time > 500) {
    const res = await axios(`https://mojtermin.mk/api/pp/resources/${id}/slots_availability`, {
      signal: AbortSignal.timeout(4000)
    })
    temp[id] = {
      data: res.data,
      time: Date.now()
    }
    return res.data
  } else {
    return temp[id].data
  }
}


function sendMaileroo(to, subject, plain) {
  const config = {
    "from": {
      "address": "terminhub@c9c7843d277b40a0.maileroo.org",
      "display_name": "Terminhub"
    },
    "to": [{
      "address": to
    }],
    "subject": subject,
    "plain": plain
  }
  axios.post('https://smtp.maileroo.com/api/v2/emails', config, {
      signal: AbortSignal.timeout(4000),
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": '723eb9048e7d19db5c183b8ac4145304a6d36b5b9a79a48e9a7de516d0ed72e3'
      }
    })
    .then(res => console.log(res.status, 'maileroo OK'))
    .catch(err => console.log(err, 'maileroo ERR'))
}


function IDInfo(id) {
  let info
  database.forEach(el => {
    if (el.id == id) {
      info = {
        name: el.name,
        specialty: el.specialty,
        location: el.location,
        hospital: el.hospital,
        tags: el.tags
      }
    }
  })
  return info
}


async function routeTimeslots(req, res) {
  try {
    const data = await getTimeslots(req.query.id)
    data ? res.send(data) : res.status(400).send()
  } catch (err) {
    console.log('routeTimeslots()', err.message, req.query.id)
  }
}


function routeSubscribe(req, res) {
  const { id, code, email } = req.query
  if (email && code && IDInfo(id) && !alreadySub()) {
    subscriptions[id] ? subscriptions[id].push({ email, code }) : subscriptions[id] = [{ email, code }]
    fs.writeFileSync('./subscriptions.json', JSON.stringify(subscriptions))
    console.log('+1 sub')
  }
  res.send('ok')

  function alreadySub() {
    let isIt = false
    if (subscriptions[id]) {
      subscriptions[id].forEach(el => {
        email == el.email ? isIt = true : 0
      })
    }
    return isIt
  }
}


function routeUnsubscribe(req, res) {
  const { id, code, email } = req.query
  if (subscriptions[id]) {
    subscriptions[id].forEach((el, index) => {
      if (el.email == email && el.code == code) {
        subscriptions[id].splice(index, 1)
        subscriptions[id].length == 0 ? delete subscriptions[id] : 0
        fs.writeFileSync('./subscriptions.json', JSON.stringify(subscriptions))
        console.log('-1 sub')
      }
    })
  }
  res.send('ok')
}


async function updateDB() {
  setTimeout(updateDB, 1000 * 60)
  try {
    const res = await axios('https://mojtermin.mk/api/pp/side_navigation')
    const data = res.data
    const newDB = []
    data[0].subsections.forEach(specijalnost => {
      specijalnost.subsections.forEach(lokacija => {
        lokacija.subsections.forEach(ustanova => {
          ustanova.subsections.forEach(doktor => {
            newDB.push({
              id: doktor.id,
              name: doktor.name,
              specialty: specijalnost.name,
              hospital: ustanova.name,
              location: lokacija.name,
              tags: 'лекари доктори'
            })
          })
        })
      })
    });
    data[1].subsections.forEach(tip => {
      tip.subsections.forEach(lokacija => {
        lokacija.subsections.forEach(ustanova => {
          ustanova.subsections.forEach(aparat => {
            newDB.push({
              id: aparat.id,
              name: aparat.name,
              specialty: tip.name,
              hospital: ustanova.name,
              location: lokacija.name,
              tags: 'апарати'
            })
          })
        })
      })
    });
    newDB.forEach(el => {
      el.name.toLowerCase().includes('ртг') ? el.tags += ' рентген рендген ренген' : 0
      el.hospital.toLowerCase().includes('гоб 8-ми септември') ? el.tags += ' 8ми осми' : 0
      el.hospital.toLowerCase().includes('ук за') ? el.tags += ' универзитетска клиника клинички центар мајка тереза' : 0
      el.hospital.toLowerCase().includes('ук по') ? el.tags += ' универзитетска клиника клинички центар мајка тереза' : 0
      el.hospital.toLowerCase().includes('13 ноември') ? el.tags += ' 13ти 13-ти' : 0
      el.location = el.location.replace('Град Скопје', 'Скопје')
    })
    database = [...newDB]
    fs.writeFileSync('./public/database.json', JSON.stringify(database))
  } catch (err) {
    console.log('updateDB() ERR:', err.message)
  }
}


// function sendNodemailer(to, subject, plain) {
//   const transporter = nodemailer.createTransport({
//     host: '???',
//     port: 465,
//     secure: true,
//     auth: {
//       user: '???',
//       pass: '???'
//     }
//   })
//   const mailOptions = {
//     from: {
//       name: '???',
//       address: '???'
//     },
//     to: to,
//     subject: subject,
//     text: plain
//   }
//   transporter.sendMail(mailOptions, function(error, info) {
//     if (error) {
//       console.log('nodemailer ERR', error)
//     } else {
//       console.log('nodemailer OK')
//     }
//   })
// }


// function sendTextbee(to, msg) {
//   axios.post('https://api.textbee.dev/api/v1/gateway/devices/????????/send-sms', {
//       recipients: to,
//       message: msg,
//     }, {
//       headers: {
//         'x-api-key': ''
//       }
//     })
//     .then(res => console.log(res.status, 'textbee OK'))
//     .catch(err => console.log(err.code, 'textbee ERR'))
// }