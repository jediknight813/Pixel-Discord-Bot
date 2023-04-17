import { Client, IntentsBitField } from "discord.js";
import { joinVoiceChannel, createAudioResource, createAudioPlayer, NoSubscriberBehavior, VoiceConnectionStatus, getVoiceConnection, entersState, getVoiceConnections } from "@discordjs/voice";
import { EndBehaviorType } from '@discordjs/voice';
import * as prism from 'prism-media';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream';
import axios from "axios";
import dotenv from 'dotenv';
import { Player } from "discord-player";


dotenv.config()
var listening = false
const allowedChannels = ['pixel-bot-chat', 'pixel-bot-test-chat', 'bot-commands']


const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildVoiceStates,
        IntentsBitField.Flags.GuildMessageReactions,
    ]
})


const handlePixelTalking = async (aiResponse, player, voiceChannel) => {

    const response={response: aiResponse.data}

    if (aiResponse.data.split(' ').length < 100) {

        axios.post(process.env.apiUrl+'generateAudio', response).then(aiAudioResponse => {
            const resource = createAudioResource('/Users/connor/projects/Pixel-Discord-Bot/src/response.mp3');
            player.play(resource);
        })

    } else {
        if (aiResponse.data.split(' ').length > 1500) {
            var chunks = chunkString(aiResponse.data, 1900);
            chunks.forEach(value =>  {
                voiceChannel.send(value)
            })
        } else {
            voiceChannel.send(aiResponse.data)
        }
    }
}

const handleContextToDatabase = (guild, context) => {
    const response={'guild': guild, 'context': context}
    axios.post(process.env.apiUrl+'addContextToMongoDB', response)
}


function chunkString(str, length) {
    var chunks = [];
    for (var i = 0; i < str.length; i += length) {
      chunks.push(str.slice(i, i + length));
    }
    return chunks;
}


client.on("ready", async (event) => {
    console.log(event.user.username, "is online.")
})


client.on('voiceStateUpdate', async (message, before, after) => {

    var botInChannel = false

    const voiceChannel = message.member.voice.channel;

    if (voiceChannel !== null) {

        voiceChannel.members.forEach(user => {
            if (user.id == client.user.id) botInChannel = true
        })


        if (botInChannel == true) {

            const voiceConnection = getVoiceConnection(voiceChannel.guild.id);
            
            if (voiceChannel.members.length <= 1) voiceConnection.destroy()

            const player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Pause,
                },
            });

            voiceConnection.subscribe(player);
            

            await entersState(voiceConnection, VoiceConnectionStatus.Ready, 20e3);
            
            voiceConnection.receiver.speaking.on('start', (userId) => {

                if (listening == true) return

                listening = true

                const receiver = voiceConnection.receiver;
                receiver.subscriptions.clear()

                const opusStream = receiver.subscribe(userId, {
                    end: {
                        behavior: EndBehaviorType.AfterSilence,
                        duration: 1000,
                    },
                });

        
                const oggStream = new prism.opus.OggLogicalBitstream({
                    opusHead: new prism.opus.OpusHead({
                        channelCount: 1,
                        sampleRate: 48000,
                    }),
                    pageSizeControl: {
                        maxPackets: 10,
                    },
                });
            
            
                const filename = "./question.ogg";
            
                const out = createWriteStream(filename);
            
                console.log(`👂 Started recording ${filename}`);
            
                pipeline(opusStream, oggStream, out, (err) => {
                    if (err) {
                        console.warn(`❌ Error recording file ${filename} - ${err.message}`);
                        listening = false
                        
                    } else {
                        console.log(`✅ Recorded ${filename}`);
                        receiver.subscriptions.clear()
                        listening = false
                        handleResponse(userId)
                    }
                });

            })


            const handleResponse = (userId) => {
                const data={filename: '../question.ogg'}
                voiceConnection.receiver.subscriptions.clear()
                const voiceChannel = client.channels.cache.get(message.member.voice.channelId);

                // transcribe what the user said.
                axios.post(process.env.apiUrl+'transcribe', data).then(response => {
                            
                    if (response.data == 'Failed') return
                    const question={question: response.data}

                    axios.post(process.env.apiUrl+'getTextCommand', question).then(TextCommand => {

                        // if there is no command just respond to what the user said.
                        if (TextCommand.data == 'Unknown.' || TextCommand.data == 'write code' || TextCommand.data == 'find resources' || TextCommand.data == 'unknown') {
                            axios.post(process.env.apiUrl+'getPixelResponse', question).then(aiResponse => {
                                handlePixelTalking(aiResponse, player, voiceChannel)
                            }
                            )

                        }

                        if (TextCommand.data == "video search") {
                            const question={question: response.data}
                            axios.post(process.env.apiUrl+'getPixelResponse', question).then(aiResponse => {
                                voiceChannel.send('<@'+userId+'> '+aiResponse.data)
                                handlePixelTalking(aiResponse, player, voiceChannel)
                                const question={question: aiResponse.data}
                                axios.post(process.env.apiUrl+'getYoutubeVideo', question).then(url => {
                                    if (url.data != 'question contains videos') {
                                        voiceChannel.send(url.data)
                                    }
                                })
                            })
                        }


                        if (TextCommand.data == "leave channel") {
                            const voiceChannel = message.member.voice.channel;
                            var botInChannel = false
                        
                            voiceChannel.members.forEach(user => {
                                if (user.id == client.user.id) botInChannel = true
                            })
            
                            const voiceConnection = getVoiceConnection(voiceChannel.guild.id);
                            voiceConnection.destroy()
                        }

                        if (TextCommand.data == "make an image") {
                            const aiResponse = {data: 'Sure, just give me a minute.'}
                            handlePixelTalking(aiResponse, player, voiceChannel)
            
                            const question={question: "make a text to image prompt for this: "+response.data}
                            
                            axios.post(process.env.apiUrl+'getPixelResponse', question).then(aiPrompt => {
                                const question={question: aiPrompt.data}
                                transcribechannel.send(aiPrompt.data);
            
                                axios.post(process.env.apiUrl+'generateImage', question).then(TextCommand => {
                                    voiceChannel.send('<@'+userId+'>')
                                    voiceChannel.send({files: ['./src/images/1.png']})
                                })
                            })
                        }
                     })

  

                }).catch(error => {
                    console.error('transcribe failed');
                });

            }

        
        }
    }

})


client.on('messageCreate', async message => {

    // check if the bot is in the voice channel
    var botInChannel = false
    const voiceChannel = message.member.voice.channel;
    if (voiceChannel !== null) {
        voiceChannel.members.forEach(user => {
            if (user.id == client.user.id) botInChannel = true
        })
    }

    if (message.content.startsWith('<@'+client.user.id+'>') && allowedChannels.includes(message.channel.name)|| message.content.startsWith('<@'+client.user.id+'>') && botInChannel == true && message.member.id !== client.user.id) { 

        var userMessage
        userMessage =  message.content.replace('<@'+client.user.id+'>', "")

        userMessage = "hey Pixel "+userMessage
        const question={question: userMessage}

        axios.post(process.env.apiUrl+'getTextCommand', question).then(TextCommand => {

            if (TextCommand.data == 'unknown' || TextCommand.data == 'write code') {
                message.channel.sendTyping()

                axios.post(process.env.apiUrl+'getPixelResponse', question).then(aiResponse => {

                    handleContextToDatabase(message.guildId, {'user_id': message.member.id, 'question': userMessage, 'response': aiResponse.data})
                    if (aiResponse.data.length > 1900) {
                        var chunks = chunkString(aiResponse.data, 1900);
                        chunks.forEach(value =>  {
                            message.reply(value)
                        })
                    } else {
                        message.reply(aiResponse.data)
                    }

                })
            }

            if (TextCommand.data == "make an image") {
                message.channel.sendTyping()
                message.reply("Just give me a minute!")

                const question={question: "make a text to image prompt for this: "+message.content.replace('<@1092968685196542012> ', '')}
                
                axios.post(process.env.apiUrl+'getPixelResponse', question).then(aiPrompt => {
                    const question={question: aiPrompt.data}
                    transcribechannel.send(aiPrompt.data);

                    axios.post(process.env.apiUrl+'generateImage', question).then(TextCommand => {
                        message.reply({files: ['./src/images/1.png']})
                    })
                })
            }


            if (TextCommand.data == "leave channel") {

                const voiceChannel = message.member.voice.channel;
                var botInChannel = false
                
                voiceChannel.members.forEach(user => {
                    if (user.id == client.user.id) botInChannel = true
                })

                // if the bot is not in a voice channel, send an error message
                if (botInChannel == false) {
                    return message.reply('I need to be in a voice channel to use this command!');
                } else {
                    const voiceConnection = getVoiceConnection(voiceChannel.guild.id);
                    voiceConnection.destroy()
                }

            }


            if (TextCommand.data == "video search") {

                message.channel.sendTyping()
                const question={question: message.content}

                axios.post(process.env.apiUrl+'getPixelResponse', question).then(aiResponse => {
                    message.reply(aiResponse.data)
                    const question={question: aiResponse.data}
                    axios.post(process.env.apiUrl+'getYoutubeVideo', question).then(url => {
                        if (url.data != 'question contains links') {
                            message.reply(url.data)
                        }
                    })

                })
            }


            if (TextCommand.data == "find resources") {

                message.channel.sendTyping()
                const question={question: message.content}

                axios.post(process.env.apiUrl+'getPixelResponse', question).then(aiResponse => {
                    message.reply(aiResponse.data)
                    const question={question: aiResponse.data}
                    axios.post(process.env.apiUrl+'getDuckDuckGoSearch', question).then(url => {
                        if (url.data != 'question contains links') {
                            message.reply(url.data)
                        }
                    })

                })

            }


            // if the text command is join channl
            if (TextCommand.data == 'join channel') {
                const voiceChannel = message.member.voice.channel;

                // if the user is not in a voice channel, send an error message
                if (!voiceChannel) {
                    message.react('❌');
                    return message.reply('You need to be in a voice channel to use this command!');
                }
                else {
                    message.react('👍');
                }

                // join the voice channel
                joinVoiceChannel({
                    channelId: message.member.voice.channelId,
                    guildId: message.guildId,
                    adapterCreator: message.guild.voiceAdapterCreator
                })
            }}


        )
    }
})


client.login(process.env.BOTPASSWORD)

