const axios = require('axios')
const express = require('express')
const app = express()
let db = []
let temp = {}
let subs = {}
let subs2 = {}


app.use(express.static('public'))
app.get('/slots', (req, res) => routeSlots(req, res))
app.get('/db', (req, res) => res.send(db))
app.get('/sub', (req, res) => routeSub(req, res))
app.get('/unsub', (req, res) => routeUnsub(req, res))
app.get('/subs', (req, res) => res.send(subs))
app.get('/subs2', (req, res) => res.send(subs2))


app.listen(3000, () => {
  console.log(`Server is running on port 3000...`)
  updateDB()
  check()
  check2()
})


async function routeSlots(req, res) {
  try {
    const data = await getSlots(req.query.id)
    data ? res.send(data) : res.status(400).send()
  } catch (err) {
    console.log('routeSlots err: ', err.message, req.query.id)
  }
}


function routeSub(req, res) {
  const { id, code, email } = req.query
  if (email && code && IDInfo(id) && !alreadySub()) {
    subs[id] ? subs[id].push({ email, code }) : subs[id] = [{ email, code }]
  }
  res.send('ok')

  function alreadySub() {
    let isIt = false
    if (subs[id]) {
      subs[id].forEach(el => {
        email == el.email ? isIt = true : 0
      })
    }
    if (subs2[id]) {
      subs2[id].forEach(el => {
        email == el.email ? isIt = true : 0
      })
    }
    return isIt
  }
}


function routeUnsub(req, res) {
  const { id, code, email } = req.query
  if (subs[id]) {
    subs[id].forEach((el, index) => {
      if (el.email == email && el.code == code) {
        subs[id].splice(index, 1)
        subs[id].length == 0 ? delete subs[id] : 0
      }
    })
  }
  if (subs2[id]) {
    subs2[id].forEach((el, index) => {
      if (el.email == email && el.code == code) {
        subs2[id].splice(index, 1)
        subs2[id].length == 0 ? delete subs2[id] : 0
      }
    })
  }
  res.send('<h1>ok</h1><title>Исклучено</title><script>alert("Исклучено")</script>')
}


function check() {
  const IDs = Object.keys(subs)
  let index = 0
  IDs.length ? doCheck() : setTimeout(check, 1000)

  async function doCheck() {
    if (index == IDs.length) {
      console.log('done')
      check()
      return
    }
    const id = IDs[index]
    if (!subs[id]) {
      index++
      doCheck()
      return
    }
    index++
    setTimeout(doCheck, 1000)
    try {
      const data = await getSlots(id)
      const name = data.name.slice(0, 60)
      let counter = 0
      for (property in data.timeslots) {
        data.timeslots[property].forEach(el => {
          el.isAvailable ? counter++ : 0
        })
      }
      console.log(counter, name)
      if (counter > 1) {
        notify(id, name)
        subs2[id] = subs[id]
        delete subs[id]
      }
    } catch (err) {
      console.log('doCheck err: ', err.message)
    }
  }
}


function check2() {
  const IDs = Object.keys(subs2)
  let index = 0
  IDs.length ? doCheck() : setTimeout(check2, 1000)

  async function doCheck() {
    if (index == IDs.length) {
      check2()
      return
    }
    const id = IDs[index]
    if (!subs2[id]) {
      index++
      doCheck()
      return
    }
    index++
    setTimeout(doCheck, 1000 * 60 * 10)
    try {
      const data = await getSlots(id)
      const name = data.name.slice(0, 60)
      let counter = 0
      for (property in data.timeslots) {
        data.timeslots[property].forEach(el => {
          el.isAvailable ? counter++ : 0
        })
      }
      if (counter == 0) {
        subs[id] = subs2[id]
        delete subs2[id]
      }
    } catch (err) {
      console.log('doCheck2 err: ', err.message)
    }
  }
}


async function getSlots(id) {
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


function notify(id, name) {
  subs[id].forEach(el => {
    const subject = `${name} има нови термини`
    const plain = `${name} има нови термини:
https://izvestime.onrender.com/slots.html?id=${id}


За да го исклучите известувањето:
https://izvestime.onrender.com/unsub?id=${id}&email=${el.email}&code=${el.code}`
    // console.log('mock send email', el.email, subject, plain)
    sendMaileroo(el.email, subject, plain)
  })
}


function sendMaileroo(to, subject, plain) {
  const config = {
    "from": {
      "address": "izvestime@546efd10e8c3419e.maileroo.org",
      "display_name": "izvestime.onrender.com"
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
        "X-Api-Key": '096308984c35ee8ed28cb5c34ecd5d34f71ce1fb522d1cf282d064e9ec9cab6f'
      }
    })
    .then(res => console.log('maileroo ok ', res.status))
    .catch(err => console.log('maileroo err: ', err))
}


async function updateDB() {
  setTimeout(updateDB, 1000 * 60 * 15)
  try {
    const res = await axios('https://mojtermin.mk/api/pp/side_navigation')
    const data = res.data
    const arr = []
    data[0].subsections.forEach(specijalnost => {
      specijalnost.subsections.forEach(lokacija => {
        lokacija.subsections.forEach(ustanova => {
          ustanova.subsections.forEach(doktor => {
            arr.push({
              id: doktor.id,
              name: doktor.name,
              specialty: specijalnost.name,
              hospital: ustanova.name,
              location: lokacija.name
            })
          })
        })
      })
    });
    data[1].subsections.forEach(tip => {
      tip.subsections.forEach(lokacija => {
        lokacija.subsections.forEach(ustanova => {
          ustanova.subsections.forEach(aparat => {
            arr.push({
              id: aparat.id,
              name: aparat.name,
              specialty: tip.name,
              hospital: ustanova.name,
              location: lokacija.name
            })
          })
        })
      })
    });
    db = [...arr]
  } catch (err) {
    console.log('updateDB err: ', err.message)
  }
}


function IDInfo(id) {
  let info
  db.forEach(el => {
    if (el.id == id) {
      info = {
        name: el.name,
        specialty: el.specialty,
        location: el.location,
        hospital: el.hospital
      }
    }
  })
  return info
}


setInterval(function() {
  axios('https://izvestime.onrender.com/sub')
    .then(res => res)
    .catch(err => err)
}, 528909)


setInterval(function() {
  axios('https://izvestime.onrender.com/unsub')
    .then(res => res)
    .catch(err => err)
}, 726381)