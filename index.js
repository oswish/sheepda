const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const jsdom = require("jsdom");

const app = express();
const port = 5000;
const { JSDOM } = jsdom;

function querySelectorMatchAll(dom, key, index) {
  const patt = new RegExp(`[a-z,0-9]*[_,-]*${key}[_,-]*[a-z]*`, 'g');
  return dom.querySelectorAll(`.${dom.innerHTML.match(patt).reduce((items, className) => {
    if (items.indexOf(className) === -1) {
      if (dom.querySelector(`.${className}`)) {
        items.push(className);
      }
    }
    return items;
  }, [])[index || 0]}`)
}


function querySelectorMatch(dom, key) {
  return querySelectorMatchAll.apply(dom, arguments)[0];
}

function findUpward(dom, className, loops) {
  const MAX = loops || 5;

  let target = dom;
  let found;
  let i;

  for (i = 0; i < MAX; i++) {
    target = target.parentNode;
    if (target.className === className) {
      found = target;

      break;
    }
  }

  return found;
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
  const host = 'https://www.getpostman.com';

  fetch(host)
    .then(
      (resp) => {
        resp.text()
          .then((data) => {
            const { document } = (new JSDOM(data)).window;

            // console.log('--->', document.cookie.indexOf('getpostmanlogin') > -1);
            // console.log('document.cookie--->', document.cookie);

            const getEvents = () => {
              const events = {
                type: 'event',
                items: []
              };

              [...querySelectorMatchAll(document.body, 'events')].forEach(dom => {
                events.items.push({date: dom.textContent, url: dom.parentNode.parentNode.href});
              });

              [...querySelectorMatchAll(document.body, 'events', 1)].forEach((dom, i) => {
                if (!events.title) {
                  events.title = findUpward(dom, 'container').textContent.split(events.items[i].date).shift();
                }

                events.items[i].location = dom.querySelector('p').textContent;
                events.items[i].title = dom.textContent.split(events.items[i].location).pop();
              });

              return events;
            };

            const mkItems = type => ({
              type,
              items: []
            });

            const getMeta = () => {
              return {
                type: 'meta',
                url: '/',
                title: document.querySelector('title').textContent,
              };
            }

            const getHeader = () => {
              const header = {type: 'header'};
              const items = [];
              const get = isTail => {
                const nav = document.querySelector('[role="navigation"]');
                const ul = [...nav.querySelectorAll('ul')];
                const list = isTail && ul.pop() || ul.shift();

                if (!header.media) {
                  const media = nav.parentNode.querySelector('img').src;

                  header.media = media.indexOf('http') === -1 && `${host}${media}` || media;
                }

                let count = 0;

                [...list.querySelectorAll('li')].forEach(li => {
                  const links = [...li.querySelectorAll('a')];
                  const link = links.shift();
                  const href = link.href;
                  const lastChar = href[href.length - 1];
                  const hasItems = lastChar === '#';

                  if (href) {
                    const count = items.push({
                      title: link.textContent,
                      url: href.indexOf('http') === -1 && `${host}${href}` || href
                    });

                    if (hasItems) {
                      const lastItem = items[count - 1];

                      lastItem.items = [];

                      delete lastItem.url;

                      [...link.parentNode.querySelector('div').querySelectorAll('a')].forEach(link => {
                        const href = link.href;
                        const url = href && (href.indexOf('http') === -1 && `${host}${href}` || href) || null;
                        const data = {title: link.textContent};

                        if (url) {
                          data.url = url;
                        }

                        lastItem.items.push(data);
                      });
                    }
                  }

                  count++;
                });

                return count;
              };

              get();

              header.items = items;
              header.tail = get(true);

              return header;
            };

            const getFooter = () => {
              const footer = {type: 'footer', items: []};
              const sections = [...document.querySelector('footer').querySelectorAll('section')];

              sections.forEach(section => {
                const data = {items: []};
                const title = section.querySelector('p');

                if (title) {
                  data.title = title.textContent;

                  const list = section.querySelector('ul');

                  if (list) {
                    [...list.querySelectorAll('a')].forEach(link => {
                      const href = link.href;

                      data.items.push({
                        title: link.textContent,
                        url: href.indexOf('http') === -1 && `${host}${href}` || href
                      });
                    });
                  }
                } else {
                  [...section.querySelectorAll('a')].forEach(link => {
                    const href = link.href;

                    data.items.push({
                      body: link.innerHTML,
                      url: href.indexOf('http') === -1 && `${host}${href}` || href
                    });
                  });
                }

                footer.items.push(data);
              });

              return footer;
            }

            const getCards = () => {
              const caseStudies = mkItems('caseStudy');
              const descriptions = mkItems('describe');
              const learnings = mkItems('learn');
              const items = [];

              [...querySelectorMatchAll(document.body, 'card')].forEach((card, i) => {
                const text = card.textContent;
                const hasQuote = text.indexOf('\"') !== -1;
                const dom = card.querySelector('[href*="/"]');

                items.push({});

                if (dom) {
                  const href = dom.href;
                  const url = href.indexOf('http') === -1 && `${host}${href}` || href;

                  items[i].url = url;
                }

                if (hasQuote && items[i].url && items[i].url.indexOf('.pdf') !== -1) {
                  const head = text.split('"').shift();

                  items[i].body = text.split(`${head}"`).pop().split('"').shift();
                  items[i].title = text.split(items[i].body).shift().split('"').shift();
                  items[i].author = text.replace(items[i].title, '').replace(items[i].body, '').split('"').pop();

                  [...querySelectorMatchAll(card, 'card-media')].forEach(mediaCard => {
                    const media = mediaCard.innerHTML.split(/src=./).pop().split('"').shift();

                    items[i].media = media.indexOf('http') === -1 && `${host}${media}` || media;
                  });

                  if (!caseStudies.title) {
                    caseStudies.title = findUpward(card , 'container').textContent.split(items[i].title).shift();
                  }

                  // caseStudy
                  caseStudies.items.push(items[i]);
                } else {

                  const title = text.substring(0, text.indexOf(
                    text.match(/[a-z,\.][A-Z]/)) + 1
                  );
                  const textNoTitle = text.split(title).pop();
                  const body = textNoTitle.split('Learn').shift();

                  items[i].title = title;
                  items[i].body = body;

                  if (Boolean(textNoTitle.match(/Learn/))) {

                    // learn
                    learnings.items.push(items[i]);

                    if (!i) {
                      const text = findUpward(card, 'container').textContent.split(items[i].title).shift();
                      const body = text.split('Postman?').pop();
                      const title = text.split(body).shift();

                      learnings.items.unshift({
                        title,
                        body
                      });
                    }

                  } else {

                    if (!descriptions.title) {
                      descriptions.title = findUpward(card, 'container').textContent.split(items[i].title).shift();
                    }

                    // describe
                    descriptions.items.push(items[i]);

                  }
                }
              });

              return [caseStudies, learnings, descriptions];
            };

            const getStats = (ctaInstead) => {
              const metrics = {type: 'metric', items: []};
              const section = document.querySelector('section');
              const stats = [...section.querySelectorAll('p')].slice(0, 7);
              const cta = stats.shift();
              const MAX = stats.length;

              if (ctaInstead) {
                const href = section.querySelector('[title^="Download"]').href;

                return {
                  type: 'cta',
                  title: section.textContent.split(cta.textContent).shift(),
                  body: cta.textContent,
                  url: href.indexOf('http') === -1 && `${host}${href}` || href
                };
              }

              let i;

              for (i = 0; i < MAX; i = i + 2) {
                metrics.items.push({
                  title: stats[i + 1].innerHTML,
                  body: stats[i].innerHTML
                });
              }

              return metrics;
            }

            const getCTA = () => getStats(true);

            const getRoles = (useCasesInstead) => {
              const roles = {type: 'role', items: []};
              const section = document.querySelectorAll('section')[2];
              const items = [...section.querySelectorAll('p')].slice(0, 4);
              const rolesDescription = items.shift();
              const MAX = items.length;

              if (useCasesInstead) {
                const container = [...section.querySelectorAll('.container')].pop();
                const cases = [...container.querySelectorAll('p')];
                const body = cases.shift();
                const bodyText = body.textContent;
                const items = [];
                const MAX_CASES = cases.length;

                let i;

                for (i = 0; i < MAX_CASES; i = i + 2) {
                  const href = cases[i].querySelector('a').href;

                  items.push({
                    title: cases[i].textContent,
                    body: cases[i + 1].textContent,
                    url: href.indexOf('http') === -1 && `${host}${href}` || href
                  });
                }

                return {
                  type: 'useCases',
                  title: container.textContent.split(bodyText).shift(),
                  body: bodyText,
                  items
                };
              }

              let i;

              for (i = 0; i < MAX; i++) {
                const href = items[i].querySelector('a').href;

                if (!roles.title) {
                  roles.body = rolesDescription.textContent;
                  roles.title = section.textContent.split(roles.body).shift();
                }

                roles.items.push({
                  title: items[i].textContent,
                  url: href.indexOf('http') === -1 && `${host}${href}` || href
                });
              }

              return roles;
            }

            const getUseCases = () => getRoles(true);

            const getNetwork = () => {
              const network = {type: 'network'};
              const section = document.querySelectorAll('section')[5];
              const body = [...section.querySelectorAll('p')].shift();
              const bodyText = body.textContent;
              const media = section.querySelector('img').outerHTML.split('src="').pop().split('"').shift();
              const link = [...section.querySelectorAll('a')].pop();
              const href = link.href;

              network.title = section.textContent.split(bodyText).shift();
              network.body = bodyText;
              network.media = media.indexOf('http') === -1 && `${host}${media}` || media;
              network.url = href.indexOf('http') === -1 && `${host}${href}` || href;
              network.cta = link.textContent;

              return network;
            };

            const getCommunity = () => {
              const community = {type: 'community'};
              const section = document.querySelectorAll('section')[6];

              let lines = [...section.querySelectorAll('p')];

              const link = lines.pop().querySelector('a');
              const href = link.href;
              const items = lines.map(line => line.textContent);
              const media = section.querySelector('img').outerHTML.split('src="').pop().split('"').shift();

              community.title = section.textContent.split(lines[0].textContent).shift();
              community.cta = link.textContent;
              community.url = href.indexOf('http') === -1 && `${host}${href}` || href;
              community.media = media.indexOf('http') === -1 && `${host}${media}` || media;
              community.items = items;

              return community;
            };

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
              describe,
              data: [getMeta(), getHeader(), getCTA(), getStats(), getRoles(), getUseCases(), ...getCards(), getNetwork(), getCommunity(), getEvents(), getFooter()]
            });
          });
      }
    );
});


app.listen(port, () => {
  console.log('server: http://localhost:5000');
});
