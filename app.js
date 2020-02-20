//=========== MAIN CODE ===========
var app = new Vue({
    el: '#app',
    data() {
        return {
            songs: [],
            current_ministry: [],
            popup: false,
            letter: 'all',
            letters: [],
            search: '',
            current_song: 0,
            is_song_from_ministry: false,
            song_title: '',
            song_text: '',
            song_text_marked: '',
            song_chords: '',
            chords_up:   ['A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A', 'B', 'D', 'E', 'G'],
            chords:      ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'Ab', 'Bb', 'Db', 'Eb', 'Gb'],
            chords_down: ['G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G', 'A', 'C', 'D', 'F'],
            transposed: 0,
            copied: false,
            updated: false,
            failed: false
        }
    },

    watch: {
        search: function(){
            //=== hightlight search words ===
            let context = document.querySelectorAll(".h_name");
            let instance = new Mark(context);

            //clear previous marks
            instance.unmark();

            //create new marks
            if(this.search.length>2){
                instance.mark(this.search, {"acrossElements": true, "synonyms": {"е": "ё"}});
            }

            //find first mark and scroll to it
            let first_mark = document.querySelector("mark");
            setTimeout(()=>{
                if(first_mark){
                    first_mark.scrollIntoView({behavior: "smooth"});
                } else {
                    window.scrollTo({top: 0, behavior: "smooth"});
                }
            }, 100);
        },

        transposed: function(value){
            if(value >= 12 || value <= -12){
                this.transposed = 0;
            }
        }
    },

    mounted() {
        if(StorageTest() && ('local_songs' in localStorage)){
            //Take songs from LocalStorage
            this.GetSongsLocal();
        } else {
            //Take songs from Google Sheets (Internet connection required)
            this.GetSongsFromInternet();
        }
    },

    methods: {
        get_text(index, index_2){
            if(index_2 || index_2 === 0){
                this.is_song_from_ministry = true;
                this.current_song = index_2;
            } else {
                this.is_song_from_ministry = false;
                this.current_song = index;
            }
            this.transposed = 0;
            this.copied = false;
            this.song_title = this.songs[index][0];

            this.song_text = this.songs[index][5];
            if(this.song_text){
                this.song_text_marked = this.song_text.replace(/(куплет|припев|запев|бридж|мост|кода|coda|проигрыш|вступление|вступ):?/gi, (match) => { return '<b>'+match+'</b>'; });
                
                setTimeout(()=>{
                    let context = document.querySelectorAll(".popup_song_text");
                    let instance = new Mark(context);
                    //clear previous marks
                    instance.unmark();
                    //create new marks
                    if(this.search.length>2){
                        instance.mark(this.search, {"acrossElements": true, "synonyms": {"е": "ё"}});
                    }
                }, 300);
            }

            this.song_chords = this.songs[index][6];
            if(this.song_chords){
                this.song_chords = this.song_chords.replace(/[ABCDEFG](#|b)?(m|maj|min|sus|dur)?(2|3|4|5|6|7|8|9|10|11|12|13)?/g, (match) => { return '<b>'+match+'</b>'; });

                this.song_chords = this.song_chords
                                    .replace(/\[/g, (match) => { return '<b class="text-gray">'; })
                                    .replace(/\]/g, (match) => { return '</b>'; })
                                    .replace(/\(/g, (match) => { return '<i class="text-gray">'; })
                                    .replace(/\)/g, (match) => { return '</i>'; });
            }
            
            if(StorageTest()){
                let key_in_storage = parseInt(localStorage.getItem(this.song_title+'_key')) || 0;
                if(key_in_storage > 0) this.transUp(Math.abs(key_in_storage));
                if(key_in_storage < 0) this.transDown(Math.abs(key_in_storage));
            }

            this.popup = true;

            window.history.pushState('text-open', null, '');

            $(window).on('popstate', () => this.ClosePopup());
        },

        ClosePopup(){
            $(window).off('popstate');
            this.popup = false;
            window.history.back();
        },

        copy_to_clipboard(title, text){
            let $temp = $("<textarea></textarea>");
            $("body").append($temp);
            $temp.val("=== "+title.toUpperCase()+" ===\r\n\r\n"+text).select();
            document.execCommand("copy");
            $temp.remove();
            this.copied = true;
        },

        transUp(steps){
            for(let i=0; i<steps; i++){
                this.song_chords = this.song_chords.replace(/[ABCDEFG](#|b)?/g,
                                (match) => {
                                    return this.chords_up[this.chords.indexOf(match)] || match;
                                });
                this.transposed++;
            }
            
            if(StorageTest()) localStorage.setItem(this.song_title+'_key', this.transposed);
        },

        transDown(steps){
            for(let i=0; i<steps; i++){
                this.song_chords = this.song_chords.replace(/[ABCDEFG](#|b)?/g,
                                (match) => {
                                    return this.chords_down[this.chords.indexOf(match)] || match;
                                });
                this.transposed--;
            }
            
            if(StorageTest()) localStorage.setItem(this.song_title+'_key', this.transposed);
        },

        GenerateLetters(){
            this.songs.forEach(item => {
                if(!this.letters.includes(item[0].substring(0,1))){
                    this.letters.push(item[0].substring(0,1));
                }
            });
        },

        GetSongsLocal(){
            if(StorageTest() && ('local_songs' in localStorage)){
                this.songs = JSON.parse(localStorage.getItem('local_songs'));
                this.GenerateLetters();
            }
            if(StorageTest() && ('current_ministry' in localStorage)){
                this.current_ministry = JSON.parse(localStorage.getItem('current_ministry'));
            }
        },

        GetSongsFromInternet(){
            this.updated = false;
            this.failed = false;

            let api_key = "AIzaSyArcu39UU0RqtdRyuT_zaqCpgYM-qQITYE";
            let sheet_id = "1jNoICtKyk6eOwivBTMs4yDNSsFx_36kUhRW5AgzKkh8";
            
            //All Songs Get From Google Sheets
            let sheet_name = "Список песен";
            let range = "!A2:G100";
            let url = "https://sheets.googleapis.com/v4/spreadsheets/"+sheet_id+"/values/"+sheet_name+range+"?key="+api_key;

            axios.get(url).then(response => {
                this.songs = response.data.values;
                if(StorageTest()) localStorage.setItem('local_songs', JSON.stringify(this.songs));
                this.GenerateLetters();
                this.updated = true;
                setTimeout(()=>{this.updated = false}, 3000);
            }).catch(error => {
                this.songs = [];
                this.letters = [];
                this.GetSongsLocal();
                this.failed = true;
                setTimeout(()=>{this.failed = false}, 3000);
                console.log(error);
            });

            //Get only songs to current ministry
            let sheet_name_2 = "Ближайшее служение";
            let range_2 = "!A1:A15";
            let url_2 = "https://sheets.googleapis.com/v4/spreadsheets/"+sheet_id+"/values/"+sheet_name_2+range_2+"?key="+api_key;

            axios.get(url_2).then(response => {
                this.current_ministry = response.data.values;

                this.current_ministry.forEach((item) => {
                    item[1] = -1;
                    this.songs.forEach((obj, index) => {
                        if(obj[0] === item[0]){
                            item[1] = index;
                        }
                    });
                });

                if(StorageTest()) localStorage.setItem('current_ministry', JSON.stringify(this.current_ministry));
            }).catch(error => {
                this.current_ministry = [];
                console.log(error);
            });
        }
    }
});



//====== LocalStorage Available? ======//
function StorageTest(){
    try {
        localStorage.setItem('test_rtdox', 'test_rtdox');
        localStorage.removeItem('test_rtdox');
        return true;
    } catch(e) {
        return false;
    }
}