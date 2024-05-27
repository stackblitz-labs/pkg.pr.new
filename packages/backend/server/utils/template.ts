export function generateTemplateHtml(
  name: string,
  files: Record<string, string>,
) {
  return `<html lang="en">
<head></head>
<body>

<form id="mainForm" method="post" action="https://stackblitz.com/run" target="_self">
${Object.entries(files)
  .map(
    ([
      file,
      contentOrUrl,
    ]) => `<input type="hidden" name="project[files][${file}]" value="${escapeHtml(contentOrUrl)}">`,
  )
  .join("\n")}
<input type="hidden" name="project[description]" value="generated by https://pkg.pr.new">
<input type="hidden" name="project[template]" value="node">
<input type="hidden" name="project[title]" value="${name}">
</form>
<script>document.getElementById("mainForm").submit();</script>

</body></html>`;
}

// https://github.com/component/escape-html/blob/master/LICENSE

// (The MIT License)

// Copyright (c) 2012-2013 TJ Holowaychuk
// Copyright (c) 2015 Andreas Lubbe
// Copyright (c) 2015 Tiancheng "Timothy" Gu

// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// 'Software'), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:

// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
// IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
// CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
// TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var matchHtmlRegExp = /["'&<>]/

function escapeHtml (string: string) {
  var str = '' + string
  var match = matchHtmlRegExp.exec(str)

  if (!match) {
    return str
  }

  var escape
  var html = ''
  var index = 0
  var lastIndex = 0

  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = '&quot;'
        break
      case 38: // &
        escape = '&amp;'
        break
      case 39: // '
        escape = '&#39;'
        break
      case 60: // <
        escape = '&lt;'
        break
      case 62: // >
        escape = '&gt;'
        break
      default:
        continue
    }

    if (lastIndex !== index) {
      html += str.substring(lastIndex, index)
    }

    lastIndex = index + 1
    html += escape
  }

  return lastIndex !== index
    ? html + str.substring(lastIndex, index)
    : html
}
