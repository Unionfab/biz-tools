def to_markdown(items: List[Dict]) -> str:
    out = []
    for it in items:
        t = it.get("type")
        if t == "text":
            out.append(str(it.get("msg", "").replace("\\n", "\n")))
        elif t == "pic":
            url = it.get("url", "")
            if url:
                out.append(f"![]({url})")
               elif t == "file":
            name = (it.get("name") or it.get("url") or "").strip()
            url = (it.get("url") or "").strip()
              if url and name:
                out.append(f"- [{name}]({url})")
            elif url:
                out.append(f"- {url}")
    # 段落间空行
    return "\n\n --- \n\n".join(out)