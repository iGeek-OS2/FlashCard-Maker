// このファイルはNetlifyのサーバー上でのみ実行されるため、安全にAPIキーを扱えます。

exports.handler = async function (event, context) {
    // POST以外のリクエストを拒否
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { pdfText, cardCount } = JSON.parse(event.body);
        
        // Netlifyの環境変数から安全にAPIキーを読み込む
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            return { statusCode: 500, body: JSON.stringify({ error: "サーバーにAPIキーが設定されていません。" }) };
        }
        if (!pdfText || !cardCount) {
             return { statusCode: 400, body: JSON.stringify({ error: "リクエストにPDFテキストまたはカード枚数が含まれていません。" }) };
        }

        const systemPrompt = `あなたは、提供されたPDFドキュメントのテキストから、重要な概念、定義、事実のみを抽出して、教育的な日本語のフラッシュカードを作成する熟練した日本人の専門家です。先生の名前、日付、ページ番号、挨拶、自己紹介、または主題と無関係な個人的なメモなど、授業内容と直接関係のない情報はすべて無視してください。あなたの唯一の仕事は、提供されたテキストから厳選された${cardCount}個のフラッシュカードをJSON配列として生成することです。JSONは '{"flashcards": [{"frontText": "...", "backText": "..."}, ...]}' の形式でなければなりません。各JSONオブジェクトは、質問用の'frontText'と答え用の'backText'を正確に含む必要があります。質問と答えは、授業の主題に厳密に基づいていなければなりません。他のテキストや説明は一切含めないでください。JSON配列は厳密に${cardCount}個のアイテムを持つ必要があります。また、絶対に英語を使用しないでください。`;
        const userQuery = `以下の授業テキストを分析し、授業の主要な概念に基づいた${cardCount}個のフラッシュカード（質問と答え）を作成してください:\n\n${pdfText}`;
        
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "z-ai/glm-4.5-air:free",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userQuery }
                ],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenRouter API Error:', errorData);
            return { statusCode: response.status, body: JSON.stringify({ error: errorData.error ? errorData.error.message : "AIモデルからのエラー" }) };
        }

        const data = await response.json();
        const content = JSON.parse(data.choices[0].message.content);

        return {
            statusCode: 200,
            body: JSON.stringify(content)
        };

    } catch (error) {
        console.error('Serverless Function Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.toString() })
        };
    }
};

