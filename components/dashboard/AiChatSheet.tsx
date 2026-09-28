const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || loading) return;

    const userMsg: Message = {
      role: "user",
      content: input.trim(),
      image: selectedImage || undefined,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setSelectedImage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-doubt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply || "Solution complete." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, doubt solve karne me thodi dikkat aayi. Please dobara try karein!",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Network issue. Please check connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };
