from flask import Flask, request
import whisper
import config
import requests
import os
from tinytag import TinyTag
import subprocess
from youtube_search import YoutubeSearch
app = Flask(__name__)
import json
from utils import findURL, duckDuckGoSearch, addContext, getChatGPTResponse
from pymongo import MongoClient
from config import MONGODBURL


# load whisper model
model = whisper.load_model("tiny.en", device='cpu')
# connect to mongoDB backend
cluster = MongoClient(MONGODBURL)
db = cluster["Pixel"]


@app.route('/transcribe', methods=['GET','POST'])
def transcribe():

    if "filename" in request.json:
        filepath = request.json['filename']

    if os.path.isfile(filepath) == False:
        return "Failed"
        
    tag = TinyTag.get(filepath)

    if tag.duration <= 1:
        return 'Failed'

    result = model.transcribe(filepath, fp16=False)

    if result["text"] == '':
        return 'Failed'
    
    if 'pixel' in result['text'].lower():
        return result["text"]
    else:
        return "Failed"


def generate_audio(text: str, output_path: str = "") -> str:
    voice_id = 'MF3mGyEYCl7XYWbV9V6O'
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": config.elevenLabs,
        "content-type": "application/json"
    }
    data = {
        "text": text,
    }
    response = requests.post(url, json=data, headers=headers)
    with open(output_path, "wb") as output:
        output.write(response.content)
    return output_path


@app.route('/getPixelResponse', methods=['GET','POST'])
def getPixelResponse():
    question = request.json['question']
    question = question.replace('<@1092968685196542012>', '')
    return getChatGPTResponse(config.ChatBot, question)



@app.route('/getTextCommand', methods=['GET','POST'])
def getTextCommand():
    question = request.json['question']
    question = question.replace('<@1092968685196542012>', '')
    return getChatGPTResponse(config.messageSorter, question)


@app.route('/generateImage', methods=['GET','POST'])
def generateImage():
    question = request.json['question']
    subprocess.run(["python3", "./tools/Image_Generation/cli_request.py", "--prompt", question+' ### '+' 3d, disfigured, bad art, deformed, poorly drawn, extra limbs, strange colors, blurry, boring, lackluster, repetitive, cropped, hands', "--steps", str(30), "--output", ('./images/1.png'), "--width", str(512), "--height", str(512), "--model", 'Deliberate'])
    return question


@app.route('/getYoutubeVideo', methods=['GET','POST'])
def getYoutubeVideo():
    question = request.json['question']
    if len(findURL(question)) > 0:
        return "question contains links"

    result = getChatGPTResponse(config.youtubeSearch, question)

    finalListOfVideosString = ''

    for c in result.split("|"):
        url = YoutubeSearch(c, max_results=1).to_json()
        JSONresults = json.loads(url)
        finalListOfVideosString += " https://www.youtube.com"+JSONresults['videos'][0]['url_suffix']+' '

    return finalListOfVideosString


@app.route('/addContextToMongoDB', methods=['GET','POST'])
def addContextToMongoDB():

    guild = request.json['guild']
    context = request.json['context']
    addContext(db, guild, context)

    return 'finished'


@app.route('/generateAudio', methods=['GET','POST'])
def generateAudio():
    response = request.json['response']
    generate_audio(response, "./response.mp3")
    return "finished"


@app.route('/getDuckDuckGoSearch', methods=['GET','POST'])
def getDuckDuckGoSearch():
    
    question = request.json['question']
    if len(findURL(question)) > 0:
        return "question contains links"
    
    result = getChatGPTResponse(config.youtubeSearch, question)
    finalList = ''

    for c in result.split("|"):
        finalList += duckDuckGoSearch(c)+' '

    return finalList


if __name__ == '__main__':
    app.run(host="127.0.0.1", port=8080, debug=True)

