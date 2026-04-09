let proxy = false;
let proxyUrl = 'https://api.fsh.plus/file?url=';
let urls = ['https://rss.nytimes.com/services/xml/rss/nyt/World.xml'];
let data = {};
let current = urls[0];
// Utils
function parseRSS(con) {
  let parser = new DOMParser();
  con = parser.parseFromString(con, 'text/xml');
  let data = {};
  data.version = con.querySelector('rss').getAttribute('version');
  if (!['2.0','0.91','0.92'].includes(data.version)) throw new Error('Unsupported version');
  data.title = con.querySelector('channel > title').innerHTML;
  data.description = con.querySelector('channel > description').innerHTML;
  data.lang = con.querySelector('channel > language')?.innerHTML;
  data.copyright = con.querySelector('channel > copyright')?.innerHTML;
  data.published = con.querySelector('channel > pubDate')?.innerHTML;
  data.updated = con.querySelector('channel > lastBuildDate')?.innerHTML;
  data.generator = con.querySelector('channel > generator')?.innerHTML;
  data.ttl = con.querySelector('channel > ttl')?.innerHTML;
  data.image = null;
  if (con.querySelector('channel > image')) {
    data.image = {
      url: con.querySelector('channel > image > url')?.innerHTML,
      alt: con.querySelector('channel > image > title')?.innerHTML
    };
  }
  data.rating = con.querySelector('channel > rating')?.innerHTML;
  data.skip = { hours: [], days: [] };
  if (con.querySelector('channel > skipHours')) data.skip.hours = Array.from(con.querySelectorAll('channel > skipHours > hour')).map(h=>Number(h.innerHTML));
  if (con.querySelector('channel > skipDays')) data.skip.days = Array.from(con.querySelectorAll('channel > skipHours > day')).map(h=>h.innerHTML);
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
        alt: item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'description')[0]?.innerHTML,
        credit: item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'credit')[0]?.innerHTML
      }
    }
    return {
      title: item.querySelector('title')?.innerHTML,
      link: item.querySelector('link')?.innerHTML,
      description: item.querySelector('description')?.innerHTML,
      author: item.querySelector('author')?.innerHTML,
      comments: item.querySelector('comments')?.innerHTML,
      guid: item.querySelector('guid')?.innerHTML,
      published: item.querySelector('pubDate')?.innerHTML||item.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'date')[0]?.innerHTML,
      file,
      source: item.querySelector('source')?({
        text: item.querySelector('source').innerHTML,
        url: item.querySelector('source').getAttribute('url')
      }):null,
      credit: item.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'creator')[0]?.innerHTML||item.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'rights')[0]?.innerHTML
    };
  });
  return data;
}
function showFile(file) {
  switch(file.type.split('/')[0]) {
    case 'image':
    case 'audio':
    case 'video':
      if (proxy) file.url = proxyUrl+encodeURIComponent(file.url);
      return `<${file.type.split('/')[0].replace('age','g')} src="${file.url}"${file.alt?` alt="${file.alt}"`:''} loading="lazy" controls></${file.type.split('/')[0].replace('age','g')}>${file.credit?`<br><span class="small">File by: ${file.credit}</span>`:''}<br>`.replace('</img>','');
    default:
      return `<a href="${file.url}" target="_blank"><button>View File</button></a>`;
  }
}
function show() {
  document.getElementById('info').innerHTML = `<b>${data[current].data.title}</b>
${data[current].data.description?`<p>${data[current].data.description}</p>`:''}
${data[current].data.image?`<img src="${proxy?proxyUrl+encodeURIComponent(data[current].data.image.url):data[current].data.image.url}" alt="${data[current].data.image.alt}">`:''}
${data[current].data.updated?`<time>Updated: ${new Date(data[current].data.updated).toLocaleString()}</time>`:''}
${data[current].data.generator?`<span class="small">Generated with: ${data[current].data.generator}</span>`:''}
${data[current].data.copyright?`<span class="small">${data[current].data.copyright.includes('©')?'':'© '} ${data[current].data.copyright}</span>`:''}`;
  document.getElementById('posts').innerHTML = data[current].data.items.map(item=>`<div>
  ${item.title?`<b>${item.title}</b>`:''}
  ${item.description?`<p>${item.description}</p>`:''}
  ${item.file?showFile(item.file):''}
  ${item.link?`<a href="${item.link}" target="_blank"><button>View</button></a>`:''}
  ${item.comments?`<a href="${item.comments}"><button>Comments</button></a>`:''}
  ${item.source?`<p class="small">Source: <a href="${item.source.url}" target="_blank">${item.source.text}</a></p>`:''}
  ${item.credit?`<p class="small">Credit: ${item.credit}</p>`:''}
  ${item.published?`<time>${(new Date(item.published)).toLocaleString()}</time>`:''}
</div>`).join('');
}
// Refresh data
setInterval(()=>{
  for (let i=0; i<urls.length; i++) {
    if (data[urls[i]]&&!(data[urls[i]] instanceof Promise)&&data[urls[i]].expire>Date.now()) continue;
    if (data[urls[i]] instanceof Promise) return;
    data[urls[i]] = fetch(proxy?proxyUrl+encodeURIComponent(urls[i]):urls[i]);
    data[urls[i]]
      .then(res=>res.text())
      .then(res=>{
        data[urls[i]] = {
          data: parseRSS(res),
          expire: Date.now()+10000000
        };
        if (urls[i]===current) show();
      })
      .catch(err=>{
        data[urls[i]] = {
          data: data[urls[i]]?.data,
          expire: Date.now()+1000
        };
      })
    return;
  }
}, 1000);