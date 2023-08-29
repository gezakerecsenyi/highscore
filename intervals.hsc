for $key in <key>[[A-G#]]:
    for $note1 in <pitch>$key:
        for $note2 in (<pitch>$key)[[$i -> $i != $note1]]:
            $difference := <interval>|| $note1, $note2 ||

            if <string>$difference != "undefined" && <number>$difference > 1:
                $name := <string>$key + "_" + <string>$note1 + "_" + <string>$note2 + "_" + <string>$difference

                render || $key | 3^4 | {3^4}<chord>[$note1, $note2] || as $name
                output [$difference, $key, $note1, $note2, $name]
