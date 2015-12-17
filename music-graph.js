!function() {

  Object.getPropertyPath = function(obj, path) {
    var spl; return new Function('return arguments[0]&&' + (spl = path.split('.')).reverse().map(function(i, j) {
      return 'arguments[0].' + spl.slice(spl.length - j - 1).reverse().join('.');
    }).join('&&'))(obj)
  };

  var ARTIST_URL = 'http://ws.audioscrobbler.com/2.0/?method=artist.getsimilar&artist={artist}&api_key=f263db2559774b3f304e95986eeec9ab&format=json';
  var ARTIST_INFO_URL = 'http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist={artist}&api_key=f263db2559774b3f304e95986eeec9ab&format=json';

  var lastClicked = null,
      processBlocked = false,
      documentOffset = function() {
        return {
          width: document.documentElement.offsetWidth,
          height: window.screen.availHeight
        };
      },
      preloader = {
        el: document.querySelector('.loader'),
        h1: document.querySelector('header h1'),
        show: function() {
          this.el.style.display = 'block';
          this.h1.classList.add('active');
        },
        hide: function() {
          this.el.style.display = 'none';
          this.h1.classList.remove('active');
        }
      };

  function getArtistUrl(artistName) {
    return ARTIST_URL.replace('{artist}', encodeURIComponent(artistName));
  }

  function getArtistInfoUrl(artistName) {
    return ARTIST_INFO_URL.replace('{artist}', encodeURIComponent(artistName));
  };

  function $jsonp(url) {
    var s,
        dN = '__'+(+new Date).toString(16);
    url += ~url.indexOf('?') ? '&callback=__cb' : '?callback=__cb';
    window.__cb = function(data) {
      window[dN] = data;
    }
    return new Promise(
      function(resolve, reject) {

     (s = document.createElement('script')).src = url;
      s.onload = function() {
        resolve(window[dN]);
        setTimeout(function() {
          delete window[dN];
          delete window.__cb;
          document.head.removeChild(s);
        });
      }
      document.head.appendChild(s);
      }
    );
  }

  function $image(url) {
  	var image = new Image();
  	preloader.show();
  	return new Promise(function(resolve, reject) {
  	  image.onload = function() {
  	  	preloader.hide();
  	    resolve(url);
  	  };
  	  image.onerror = function() {
  	  	preloader.hide();
  	    reject();
  	  };
  	  image.src = url;
  	});
  }

  function $cache(artist) {
    var key = artist.replace(/\s/g, '_'),
        c = JSON.parse(window.localStorage.getItem(key));
    return new Promise(
      function(resolve) {
        if (c) { resolve(c); return; }
        $jsonp(getArtistUrl(artist))
         .then(function(data) {
            window.localStorage.setItem(key, JSON.stringify(data));
            resolve(data);
         });  
      }
    );
  }

  function ArtistCircle(config) {
    this.config = config;

    this._getNetworkById = function(id) {
      var returnArray = [],
          networkedDOMElements = [],
          networkedConnections = [];

      networkedDOMElements = 
       networkedDOMElements.concat(
        [].slice.call(document.querySelectorAll('[data-id="' + id + '"]'))
       );
      networkedConnections = networkedConnections.concat(
       jsPlumb.getConnections(id).map(function(connection) {
         return connection.canvas;
       })
      );

      return networkedDOMElements.concat(networkedConnections);
    };

    this._getInnerTextContent = function() {
      var parentName = this.config.item.parentName,
          name = this.config.item.name,
          matchFactor = ( this.config.item.match * 100 ).toFixed(2);

      var innerSpan = [
        '<span class="similar"><br>Similarity to ',
        parentName, ': ', matchFactor, '%', '</span>'].join( '' ); 
      var outerSpan = [
        '<span>', name,
        ( parentName ? innerSpan : '' ),
        '</span>'].join( '' );

      return outerSpan;
    };

    this._getDOMCircle = function() {
      var circ;
      var multiplyFactor = ((this.config.item.match || 1) * 4);

      (circ = document.createElement('div')).classList.add('circle');
       circ.dataset.id = this.config.item.id;
       circ.style.top = this.config.y + 'px';
       circ.style.left = this.config.x + 'px';
       circ.style.backgroundImage = 'url(' + this.config.item.image + ')';
       circ.style.width = (this.config.item.dataSetLength || 30) * multiplyFactor + 'px';
       circ.style.height = (this.config.item.dataSetLength || 30) * multiplyFactor + 'px';
       circ.innerHTML = this._getInnerTextContent();

       return circ;
    };

    this._configOnMouseOver = function(DOMElement) {
      var that = this;
      DOMElement.addEventListener('mouseover', function() {
        var network = that._getNetworkById(this.dataset.id);
        network.forEach(function(node) {
          if (node instanceof SVGElement) {
            node.classList.add('conn-hover');              
          } else {
            node.classList.add('circle-hover');
          }
        });
      });
    };

    this._configOnMouseOut = function(DOMElement) {
      var that = this;
      DOMElement.addEventListener('mouseout', function() {
        var network = that._getNetworkById(this.dataset.id);
        network.forEach(function(node) {
          node.classList.remove('circle-hover');
          node.classList.remove('conn-hover');
        });
      });
    };

    this._configOnClick = function(DOMElement) {
      var that = this;

      DOMElement.addEventListener('click', function(e) {
        if (processBlocked || this.alreadyGraphed) {
          return;
        }
        this.alreadyGraphed = true;
        var network = that._getNetworkById(this.dataset.id);
        network.forEach(function(node) {
          if (node instanceof SVGElement) {
            node.classList.remove('conn-hover');
          } else {
            node.dispatchEvent(new Event('mouseout'));
          }
        });

        var uuid = (+new Date).toString(16);
        
        setTimeout(function() {
          displayCircle(that.config.item.name, this.offsetTop, this.offsetLeft, uuid);        	
        }.bind(this), 100);
        
        setTimeout(function() {
          $image(that.config.item.largeImage)
            .then(function(url) {
          	  document.querySelector('.bkg')
          	    .style.backgroundImage = 'url(' + url + ')';          	
          	  });        	
        }, 200);
        
        document.querySelector('#artist-name').innerText = that.config.item.name;
        this.dataset.id = uuid;
        processBlocked = true;
        lastClicked = this;
      });
    };
  };

  ArtistCircle.prototype.getNetworkById = function() {
    return this._getNetworkById.apply(this, [].slice.call(arguments));
  };

  ArtistCircle.prototype.draw = function() {
    var domCircle = this._getDOMCircle();

    this._configOnClick(domCircle);
    this._configOnMouseOver(domCircle);
    this._configOnMouseOut(domCircle);

    setTimeout(function() {
      document.body.appendChild(domCircle);
      if (lastClicked) {
        jsPlumb.connect({
          source: domCircle,
          target: lastClicked,
          connector: ['Straight', { curviness: 20 }],
          paintStyle: {
            strokeStyle: '#000',
            lineWidth: 1,
            opacity: .3
          },
          anchor: 'Center',
          endpoint: 'Blank',
          scope: this.config.item.id
        });
      }
    }.bind(this), Math.random() * 400);
  };

  function parse(data) {
    var artist = data.artist;
    data = Object.getPropertyPath(data, 'similarartists.artist') || [];
    data = data.slice(0,20);
    data = data.map(function(d) {
      return {
        name: d.name,
        match: +d.match,
        image: d.image[3]['#text'],
        largeImage: d.image[4]['#text']
      };
    });
    data.artist = artist;
    return data;
  }

  function display(data, top, left, id) {
    var step = 2 * Math.PI / data.length,
      h = top + data.length + 20,
      k = left - data.length + 30,
      K_R = data.length * 8,
      counter = 0;

    for (var theta = 0; theta < 2 * Math.PI; theta += step) {
      counter++;
      var item = data[counter];
      var r = K_R;
      var x = k + r * Math.cos(theta);
      var y = h - r * Math.sin(theta);

      if (item) {
        var circle = new ArtistCircle({
          x: x,
          y: y,
          item: {
            originalX: h,
            originalY: k,
            parentName: data.artist,
            id: id,
            name: item.name,
            image: item.image,
            largeImage: item.largeImage,
            match: item.match,
            dataSetLength: data.length
          }
        });
        circle.draw();
      }
    }

    setTimeout(function() {
      circle.getNetworkById(id)
       .forEach(function(div) {
         !(div instanceof SVGElement) && div.classList.add('circle-hover');
       })
    }, 500);
  }

  function displayCircle(artist, y, x, id) {
    preloader.show();
    $cache(artist)
     .then(function(data) {
        data.artist = artist;
        processBlocked = false;
       display(parse(data), y, x, id);
       preloader.hide();
     });
  }

  window.addEventListener('DOMContentLoaded', function() {
    document.querySelector('#graph')
      .addEventListener('click', function(e) {
        e.preventDefault();
        preloader.show();
        $jsonp(getArtistInfoUrl(document.querySelector('#artist-value').value))
         .then(function(data) {
             document.querySelector('form').style.opacity = 0;
             (new ArtistCircle({
               x: documentOffset().width / 2.2,
               y: documentOffset().height / 3,
               item: {
                 name: data.artist.name,
                 image: data.artist.image[3]['#text'],
                 largeImage: data.artist.image[4]['#text'],
                 id: (+new Date).toString(16)
               }
             })).draw();
             preloader.hide();
         });
    })
  });
}();