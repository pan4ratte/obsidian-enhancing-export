--[==[
  remote.lua — images the note names by URL, read from where the plugin put them

  Pandoc fetches a remote image itself. Its wasm build cannot: it has no network
  at all, so an `![](https://…/a.png)` exports as a broken image and nobody
  notices until the document is read.

  So the plugin fetches them before the conversion starts — it is the one party
  here that can reach the network — writes them into the file system the run
  will use, and lists them in `.obsidian-remote`: one image a line, the URL
  exactly as the note wrote it, a tab, then the path it was written to.

  This filter is what puts that list into the document. It runs last, after the
  filters that expand embedded notes, so an image inside an embed is rewritten
  along with the rest.

  An image whose URL is not in the list is left exactly as it was — a download
  that failed is pandoc's to complain about, as it always was.
]==]

local at = {}

local list = io.open('.obsidian-remote', 'r')
if list then
  for line in list:lines() do
    local url, path = line:match('^(.-)\t(.*)$')
    if url and path and url ~= '' then
      at[url] = path
    end
  end
  list:close()
end

function Image(image)
  local path = at[image.src]
  if path then
    image.src = path
    return image
  end
end
