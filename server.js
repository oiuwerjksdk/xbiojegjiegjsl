const axios = require('axios')
const express = require('express')
const app = express()
let db = []
let subs = {}
let subs2 = {}
let temp = {}


app.use(express.static('public'))
app.get('/db', (req, res) => res.send(db))
app.get('/slots', (req, res) => routeSlots(req, res))
app.get('/sub', (req, res) => routeSub(req, res))
app.get('/unsub', (req, res) => routeUnsub(req, res))


app.listen(3000, () => {
  console.log(`Server is running on port 3000...`)
  iterate()
  iterate2()
  updateDB()
})


async function routeSlots(req, res) {
  try {
    const data = await getSlots(req.query.id)
    data ? res.send(data) : res.status(400).send()
  } catch (err) {
    console.log('ERR routeSlots:', err.message, req.query.id)
  }
}


function routeSub(req, res) {
  const { id, code, email } = req.query
  if (email && code && IDInfo(id) && !alreadySub()) {
    subs[id] ? subs[id].push({ email, code }) : subs[id] = [{ email, code }]
    console.log('+1 sub')
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
        console.log('-1 sub')
      }
    })
  }
  if (subs2[id]) {
    subs2[id].forEach((el, index) => {
      if (el.email == email && el.code == code) {
        subs2[id].splice(index, 1)
        subs2[id].length == 0 ? delete subs2[id] : 0
        console.log('-1 sub 2')
      }
    })
  }
  res.send('ok<title>Исклучено</title><script>alert("Исклучено")</script>')
}


function iterate() {
  const IDs = Object.keys(subs)
  let index = 0
  IDs.length ? check() : setTimeout(iterate, 1000)

  async function check() {
    if (index == IDs.length) {
      console.log('all done')
      iterate()
      return
    }
    const id = IDs[index]
    if (!subs[id]) {
      index++
      check()
      return
    }
    index++
    setTimeout(check, 1000)
    try {
      const data = await getSlots(id)
      const name = data.name.slice(0, 60)
      let counter = 0
      for (property in data.slots) {
        data.slots[property].forEach(el => {
          el.isAvailable ? counter++ : 0
        })
      }
      console.log(counter, name, ':', subs[id])
      if (counter > 1) {
        notify(id, name)
        subs2[id] = subs[id]
        delete subs[id]
      }
    } catch (err) {
      console.log(err.message, id)
    }
  }
}


function iterate2() {
  const IDs = Object.keys(subs2)
  let index = 0
  IDs.length ? check() : setTimeout(iterate2, 1000)

  async function check() {
    if (index == IDs.length) {
      console.log('all done 2')
      iterate2()
      return
    }
    const id = IDs[index]
    if (!subs2[id]) {
      index++
      check()
      return
    }
    index++
    setTimeout(check, 5000)
    try {
      const data = await getSlots(id)
      const name = data.name.slice(0, 60)
      let counter = 0
      for (property in data.slots) {
        data.slots[property].forEach(el => {
          el.isAvailable ? counter++ : 0
        })
      }
      console.log(counter, name, ':', subs2[data.id], ' 2')
      if (counter == 0) {
        subs[id] = subs2[id]
        delete subs2[id]
      }
    } catch (err) {
      console.log(err.message, id)
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
https://mojtermin2.onrender.com/slots.html?id=${id}


За да го исклучите известувањето:
https://mojtermin2.onrender.com/unsub?id=${id}&email=${el.email}&code=${el.code}`
    // console.log('mock send email', el.email, subject, plain)
    sendMaileroo(el.email, subject, plain)
  })
}


function sendMaileroo(to, subject, plain) {
  const config = {
    "from": {
      "address": "mojtermin2@c9c7843d277b40a0.maileroo.org",
      "display_name": "mojtermin2.onrender.com"
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


async function updateDB() {
  setTimeout(updateDB, 1000 * 60)
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
    console.log('ERR updateDB:', err.message)
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
  axios('https://mojtermin2.onrender.com/')
    .then(res => res)
    .catch(err => err)
}, 23482)


setInterval(function() {
  axios('https://mojtermin2.onrender.com/')
    .then(res => res)
    .catch(err => err)
}, 76893)