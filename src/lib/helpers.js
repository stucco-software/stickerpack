import unique from 'unique-selector'

function createXPathFromElement(elm) {
    var allNodes = document.getElementsByTagName('*');
    for (var segs = []; elm && elm.nodeType == 1; elm = elm.parentNode)
    {
        if (elm.hasAttribute('id')) {
                var uniqueIdCount = 0;
                for (var n=0;n < allNodes.length;n++) {
                    if (allNodes[n].hasAttribute('id') && allNodes[n].id == elm.id) uniqueIdCount++;
                    if (uniqueIdCount > 1) break;
                };
                if ( uniqueIdCount == 1) {
                    segs.unshift('id("' + elm.getAttribute('id') + '")');
                    return segs.join('/');
                } else {
                    segs.unshift(elm.localName.toLowerCase() + '[@id="' + elm.getAttribute('id') + '"]');
                }
        } else if (elm.hasAttribute('class')) {
            segs.unshift(elm.localName.toLowerCase() + '[@class="' + elm.getAttribute('class') + '"]');
        } else {
            let i
            let sib
            for (i = 1, sib = elm.previousSibling; sib; sib = sib.previousSibling) {
                if (sib.localName == elm.localName)  i++; };
                segs.unshift(elm.localName.toLowerCase() + '[' + i + ']');
        };
    };
    return segs.length ? '/' + segs.join('/') : null;
};

function lookupElementByXPath(path) {
    var evaluator = new XPathEvaluator();
    var result = evaluator.evaluate(path, document.documentElement, null,XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return  result.singleNodeValue;
}

const stick2Node = (event) => {
  let xpath = createXPathFromElement(event.target)
  let coolnode = lookupElementByXPath(xpath)
  let clickX = event.offsetX
  let clickY = event.offsetY
  let nodeX = event.target.offsetWidth
  let nodeY = event.target.offsetHeight
  let stickerX = clickX / nodeX
  let stickerY = clickY/ nodeY
  let sticker = {
    xpath,
    x: stickerX,
    y: stickerY
  }
  return sticker
}

const placeSticker = (sticker) => {
  let eyeStickerRoot = document.getElementById("eyesticker")
  let eyeStickerTemplate = eyeStickerRoot.cloneNode(true);
  let eyeSticker = eyeStickerTemplate.content

  console.log(eyeSticker)
  eyeSticker.firstElementChild.style['left'] = `${sticker.x * 100}%`
  eyeSticker.firstElementChild.style['top'] = `${sticker.y * 100}%`

  let targetNode = lookupElementByXPath(sticker.xpath)
  targetNode.appendChild(eyeSticker)
}

export const mountStickerPack = () => {
  document.addEventListener('click', e => {
    let sticker = stick2Node(e)
    placeSticker(sticker)
  })
}

export const unmountStickerPack = () => {
  // document.removeEventListener('click', getNode)
}
