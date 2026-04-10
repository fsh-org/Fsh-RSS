Split(['#settings', '#posts', '#info'], {
  minSize: 0,
  sizes: [25, 50, 25]
});

let proxyUrl = 'https://api.fsh.plus/file?url=';
let current = 0;
let feeds = [
  {
    name: 'NYT News',
    group: 'news',
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    proxy: false
  },
  {
    name: 'Rebane',
    group: 'blog',
    url: 'https://lyra.horse/blog/posts/index.xml',
    proxy: true
  }
];
let data = {};

// Utils
function removeTags(txt) {
  if (!txt) return txt;
  return txt.replaceAll(/<[^>]*>/g, '');
}
function parseRSS(con) {
  let parser = new DOMParser();
  con = parser.parseFromString(con, 'text/xml');
  if (!con.querySelector('rss')) throw new Error('Invalid document');
  let data = {};
  data.version = con.querySelector('rss').getAttribute('version');
  if (!['2.0','0.91','0.92'].includes(data.version)) throw new Error('Unsupported version');
  data.title = removeTags(con.querySelector('channel > title')?.innerHTML);
  data.description = con.querySelector('channel > description')?.innerHTML;
  data.lang = removeTags(con.querySelector('channel > language')?.innerHTML);
  data.copyright = removeTags(con.querySelector('channel > copyright')?.innerHTML);
  data.published = removeTags(con.querySelector('channel > pubDate')?.innerHTML);
  data.updated = removeTags(con.querySelector('channel > lastBuildDate')?.innerHTML);
  data.generator = removeTags(con.querySelector('channel > generator')?.innerHTML);
  data.ttl = removeTags(con.querySelector('channel > ttl')?.innerHTML);
  data.image = null;
  if (con.querySelector('channel > image')) data.image = {
    url: con.querySelector('channel > image > url')?.innerHTML,
    alt: removeTags(con.querySelector('channel > image > title')?.innerHTML)
  };
  data.rating = con.querySelector('channel > rating')?.innerHTML;
  data.skip = { hours: [], days: [] };
  if (con.querySelector('channel > skipHours')) data.skip.hours = Array.from(con.querySelectorAll('channel > skipHours > hour')).map(h=>Number(h.innerHTML));
  if (con.querySelector('channel > skipDays')) data.skip.days = Array.from(con.querySelectorAll('channel > skipDays > day')).map(h=>h.innerHTML);
  // Items
  data.items = Array.from(con.querySelectorAll('channel > item')).map(item=>{
    let file = null;
    if (item.querySelector('enclosure')) {
      file = {
        url: item.querySelector('enclosure').getAttribute('url'),
        type: item.querySelector('enclosure').getAttribute('type')
      };
    } else if (item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'thumbnail')[0]) {
      file = {
        url: item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'thumbnail')[0].getAttribute('url'),
        type: 'image/'
      }
    } else if (item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content')[0]) {
      let content = item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content')[0];
      file = {
        url: content.getAttribute('url'),
        type: (content.getAttribute('medium')??'image')+'/',
        alt: removeTags(item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'description')[0]?.innerHTML),
        credit: removeTags(item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'credit')[0]?.innerHTML)
      }
    }
    return {
      title: removeTags(item.querySelector('title')?.innerHTML),
      link: removeTags(item.querySelector('link')?.innerHTML),
      description: item.querySelector('description')?.innerHTML,
      author: removeTags(item.querySelector('author')?.innerHTML),
      comments: removeTags(item.querySelector('comments')?.innerHTML),
      guid: removeTags(item.querySelector('guid')?.innerHTML),
      published: removeTags(item.querySelector('pubDate')?.innerHTML||item.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'date')[0]?.innerHTML),
      file,
      source: item.querySelector('source')?({
        text: removeTags(item.querySelector('source').innerHTML),
        url: item.querySelector('source').getAttribute('url')
      }):null,
      credit: removeTags(item.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'creator')[0]?.innerHTML||item.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'rights')[0]?.innerHTML)
    };
  });
  return data;
}
function showFile(file) {
  switch(file.type.split('/')[0]) {
    case 'image':
    case 'audio':
    case 'video':
      return `<${file.type.split('/')[0].replace('age','g')} src="${feeds[current].proxy?proxyUrl+encodeURIComponent(file.url):file.url}"${file.alt?` alt="${file.alt}"`:''} loading="lazy" controls></${file.type.split('/')[0].replace('age','g')}>${file.credit?`<br><span class="small">File by: ${file.credit}</span>`:''}<br>`.replace('</img>','');
    default:
      return `<a href="${file.url}" target="_blank"><button>View File</button></a>`;
  }
}
function displayHtml(btn, idx) {
  btn.remove();
  document.querySelector(`p.desc[data-idx="${idx}"]`).outerHTML = `<iframe class="desc" data-idx="${idx}"></iframe>`;
  let html = data[feeds[current].url].data.items[idx].description.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&amp;','&');
  if (!(/<body .*?>/i).test(html)) html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="color-scheme" content="dark light"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>${html}</body></html>`;
  let iframe = document.querySelector(`iframe.desc[data-idx="${idx}"]`);
  iframe.setAttribute('referrerpolicy', 'no-referrer');
  iframe.setAttribute('sandbox', 'allow-popups');
  iframe.srcdoc = html;
}

function show() {
  let cur = data[feeds[current].url].data;
  document.getElementById('info').innerHTML = `<b>${cur.title}</b>
${cur.description?`<p>${cur.description}</p>`:''}
${cur.image?`<img src="${feeds[current].proxy?proxyUrl+encodeURIComponent(cur.image.url):cur.image.url}" alt="${cur.image.alt}">`:''}
${cur.updated?`<time>Updated: ${new Date(cur.updated).toLocaleString()}</time>`:''}
${cur.generator?`<span class="small">Generated with: ${cur.generator}</span>`:''}
${cur.copyright?`<span class="small">${cur.copyright.includes('©')?'':'© '} ${cur.copyright}</span>`:''}`;
  document.getElementById('posts').innerHTML = cur.items.map((item,i)=>`<div>
  ${item.title?`<b>${item.title}</b>`:''}
  ${item.description?`<p class="desc" data-idx="${i}">${item.description}</p>`:''}
  ${item.file?showFile(item.file):''}
  ${item.link?`<a href="${item.link}" target="_blank"><button>View</button></a>`:''}
  ${item.comments?`<a href="${item.comments}"><button>Comments</button></a>`:''}
  ${(/&lt;[a-z][a-z0-9-]*(\s.*?)?&gt;/i).test(item.description)?`<button onclick="displayHtml(this, ${i})">Display HTML</button>`:''}
  ${item.source?`<p class="small">Source: <a href="${item.source.url}" target="_blank">${item.source.text}</a></p>`:''}
  ${item.credit?`<p class="small">Credit: ${item.credit}</p>`:''}
  ${item.published?`<time>${(new Date(item.published)).toLocaleString()}</time>`:''}
</div>`).join('');
}

function showSettings() {
  let groups = new Set();
  feeds.forEach(feed=>groups.add(feed.group));
  document.querySelector('#settings .list').innerHTML = Array.from(groups)
    .map(group=>`<b><label><input type="checkbox"> ${group}</label></b>
<div data-parent="${group}">
  ${feeds
    .map((feed,i)=>{ feed.idx=i; return feed })
    .filter(feed=>feed.group===group)
    .map(feed=>`<label><input type="checkbox"> <button onclick="current=${feed.idx};show();">${feed.name}</button></label>`)
    .join('')}
</div>`)
    .join('');
}

// Refresh data
setInterval(()=>{
  for (let i=0; i<feeds.length; i++) {
    if (data[feeds[i].url]&&!(data[feeds[i].url] instanceof Promise)&&data[feeds[i].url].expire>Date.now()) continue;
    if (data[feeds[i].url] instanceof Promise) continue;
    data[feeds[i].url] = fetch(feeds[i].proxy?proxyUrl+encodeURIComponent(feeds[i].url):feeds[i].url);
    data[feeds[i].url]
      .then(res=>res.text())
      .then(res=>{
        let rssdata = parseRSS(res);
        data[feeds[i].url] = {
          data: rssdata,
          expire: Date.now()+(10 * 60 * 1000) // 10 min default
        };
        if (i===current) show();
      })
      .catch(err=>{
        let time = (data[feeds[i].url].errtime||0);
        data[feeds[i].url] = {
          data: data[feeds[i].url]?.data,
          expire: Date.now()+1000+(time*time*5*1000), // 1 sec, 6 sec, 21 sec, 46 sec...
          errtime: time+1
        };
      })
    return;
  }
}, 1000);

showSettings();