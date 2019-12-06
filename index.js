const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const jsdom = require("jsdom");

const app = express();
const port = 5000;
const { JSDOM } = jsdom;

function querySelectorMatchAll(dom, key) {
  const patt = new RegExp(`[a-z,0-9]*[_,-]*[a-z]*[_,-]*${key}[_,-]*[a-z]*`, 'g');
  return dom.querySelectorAll(`.${dom.innerHTML.match(patt).reduce((items, className) => {
    if (items.indexOf(className) === -1) {
      if (dom.querySelector(`.${className}`)) {
        items.push(className);
      }
    }
    return items;
  }, []).shift()}`)
}

function querySelectorMatch(dom, key) {
  return querySelectorMatchAll.apply(dom, arguments)[0];
}

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.set('json spaces', 2);

// Body parser
app.use(express.urlencoded({ extended: false }));

// Home route
app.get('/', (req, res) => {
  res.send('a basic express App');
});

app.get('/pm', (req, res) => {
  fetch('https://www.getpostman.com/')
    .then(
      (r) => {
        r.text()
          .then((data) => {
            const { document } = (new JSDOM(data)).window;

            [...querySelectorMatchAll(document.body,'events')].forEach(d => {
              console.log(
                `${querySelectorMatch(d, 'date').textContent}: ${querySelectorMatch(d, 'details').textContent}`
              )
            })

            const title = data.split('</h1>').shift().split('>').pop();
            const cta = data.split(title).pop().split('</p>').shift().split('>').pop();
            const url = data.split(cta).pop().split('</a>').shift().split('href="').pop().split('"').shift();
            const hero = data.substr(data.indexOf('<section')).substr(data.substr(data.indexOf('<section')).indexOf('src="') + 5).split('"').shift();
            const statsList = data.split(hero).pop().split('</p>').map(item => item.split('>').pop()).slice(0, 6);
            const stats = {
              [statsList[1]]: statsList[0],
              [statsList[3]]: statsList[2],
              [statsList[5]]: statsList[4]
            };
            const describe = [];

            let explaination = data.split('</h2>').shift().split('>').pop();

            describe.push({
              title: explaination,
              body: data.split(`${explaination}</h2>`).pop().substr(data.split(`${explaination}</h2>`).pop().indexOf('>') + 1).split('<').shift()
            });


            explaination = data.split('</h3>').shift().split('>').pop();

            describe.push({
              title: explaination,
              body: data.split(`${explaination}</h3>`).pop().split('</p>').shift().split('<p>').pop(),
              url: data.substr(data.indexOf(`${explaination}</h3>`)).substring(data.substr(data.indexOf(`${explaination}</h3>`)).indexOf('href="') + 6).split('"').shift()
            });

            const features = [];

            data.split('</h3>').forEach(item => {
              let snippet = item.substr(item.indexOf('h3'));

              snippet = snippet.substr(snippet.indexOf('>') + 1);

              if ( snippet.split(/\r?\n/).length < 2 && snippet.indexOf('<') === -1 && snippet.indexOf('>') === -1 ) {
                features.push(snippet);
              }
            });

            features.slice(0, 5).forEach(title => {
              describe.push({
                title,
                body: data.split(`${title}</h3>`).pop().substr(data.split(`${title}</h3>`).pop().indexOf('>') + 1).split('<').shift(),
                url: data.substr(data.indexOf(`${title}</h3>`)).substring(data.substr(data.indexOf(`${title}</h3>`)).indexOf('href="') + 6).split('"').shift()
              });
            });

            res.json({
              title,
              cta,
              url,
              hero,
              stats,
              describe
            });
          });
      }
    );
});


app.listen(port, () => {
  console.log('server: http://localhost:5000');
});