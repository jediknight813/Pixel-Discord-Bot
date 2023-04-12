import re
from duckduckgo_search import ddg
from config import MONGODBURL
from pymongo import MongoClient
import openai
import config
openai.organization = config.organization
openai.api_key = config.api_key


def findURL(string):
    regex=r"(?i)\b((?:https?://|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'\".,<>?«»“”‘’]))"
    url= re.findall(regex,string)
    return [x[0] for x in url]


def duckDuckGoSearch(keywords):
    results = ddg(keywords, region='wt-wt', safesearch='Off', time='y', max_results=1)

    if len(results) >= 1:
        return results[0]['href']
    else:
        return ''


def addContext(db, guild, context):
    print(guild, context)
    collection = db[guild]
    collection.insert_one(context)


def fetchUserContexts(db, guild, user_id):
    contexts = []

    collection = db[guild]
    cursor = collection.find( { 'user_id': user_id }).limit(5)

    for document in cursor:
        contexts.append({'user': document['question']})
        contexts.append({'assistant': document['response']})

    return contexts


def getChatGPTResponse(prompt, context):
        prompt.append({"role": "user", "content": context})

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=prompt
        )

        result = ''
        for choice in response.choices:
            result += choice.message.content    
        
        return result

