#!/bin/zsh
# Fase 0 (A2), 01/10: los 6 agentes de una corrida con Data Intelligence. Se guarda en el repo como
# Workflows/workflow-short-form-content/fixtures/virlo/sonda-2026-10-01.sh
cd /Users/mani/Desktop/mani/work/retia/repos/pipeline-creacion-contenido
set -a && source .env && set +a
L=Workflows/workflow-short-form-content/fixtures/virlo/crudo/logs; mkdir -p $L
a() { local slug=$1; shift; node Workflows/workflow-short-form-content/sonda-virlo.mjs agent --di --apply --name "fase0 $slug" "$@" > $L/$slug.log 2>&1 & }

I_T1="Find short educational videos by psychologists and therapists about emotional regulation and emotional intelligence, not motivational quotes, comedy skits or personal vlogs."
I_T2="Find short educational videos where experienced traders explain trading psychology, discipline and mindset, not chart-only screen recordings, signals or get-rich-quick promises."
I_T3="Find short educational videos with practical scripts for communicating at work: difficult conversations, giving feedback, talking to your boss and leading a team, not relationship advice, comedy or generic productivity tips."
I_T3PT="Encontre vídeos curtos e educativos com roteiros práticos para se comunicar no trabalho: conversas difíceis, dar feedback, falar com o chefe e liderar uma equipe, não conselhos de relacionamento, comédia ou dicas genéricas de produtividade."
I_T3FR="Trouve des vidéos courtes et éducatives avec des scripts pratiques pour communiquer au travail : conversations difficiles, donner du feedback, parler à son manager et diriger une équipe, pas de conseils amoureux, de comédie ni d'astuces de productivité génériques."

K_T1="emotional regulation psychologist;emotional intelligence therapist;regulate emotions expert;psychology emotional skills;therapy emotional control;mental health emotional regulation;emotional intelligence explained;therapist emotional coping;psychologist emotional tools;emotional literacy expert;emotional triggers;anger management;distress tolerance;nervous system regulation"
K_T2="trading psychology;trader mindset;trading discipline;emotional trading;forex psychology;stock market mindset;trading mental game;successful trader habits;investing psychology;day trading mindset;fear and greed trading;revenge trading;overtrading;trading journal"
K_T3EN="workplace communication tips;difficult conversations work;giving feedback at work;talking to your boss;leading a team communication;professional communication skills;script for difficult conversation;effective workplace dialogue;manager communication strategies;team leadership communication;how to say no at work;managing up;assertive communication at work"
K_T3PT="comunicação no trabalho;conversas difíceis trabalho;dar feedback profissional;falar com chefe;liderar equipe comunicação;roteiros comunicação trabalho;habilidades comunicação profissional;comunicação eficaz trabalho;diálogo construtivo trabalho;gestão de conflitos trabalho"
K_T3FR="communication travail;conversations difficiles travail;donner feedback constructif;parler à son manager;diriger une équipe communication;communication professionnelle;gestion conflits travail;leadership communication;scripts communication travail;améliorer communication pro"

a t1-emocional   --intent "$I_T1" --keywords "$K_T1" --exclude "quotes;comedy;skit;prank;vlog;meme;funny"
a t2-trading     --intent "$I_T2" --keywords "$K_T2" --exclude "signals;giveaway;copytrading;bot"
a t3-en          --intent "$I_T3" --keywords "$K_T3EN" --exclude "relationship;dating;marriage;comedy;funny;skit;prank"
a t3-mezcla      --intent "$I_T3" --keywords "$K_T3EN;$K_T3PT;$K_T3FR" --exclude "relationship;dating;marriage;comedy;funny;skit;prank;relacionamento;namoro;comédia;engraçado;amour;couple;drôle;humour"
a t3-pt          --intent "$I_T3PT" --keywords "$K_T3PT" --exclude "relacionamento;namoro;comédia;engraçado;piada;meme"
a t3-fr          --intent "$I_T3FR" --keywords "$K_T3FR" --exclude "amour;couple;drôle;humour;blague"
wait
