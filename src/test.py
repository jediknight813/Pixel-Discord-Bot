from youtube_search import YoutubeSearch
import json

results = YoutubeSearch('Best Clone Wars Memes Compilation (Seasons 1-7)', max_results=1).to_json()

JSONresults = json.loads(results)

print(JSONresults['videos'][0]['url_suffix'])

