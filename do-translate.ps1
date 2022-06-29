Function Do-Translate {
    Param(
        [Switch] $Compile
    )

    if (-not $Compile) {
        pybabel extract -F babel.cfg -o messages.pot .
        pybabel update -i messages.pot -d translations
    } else {
        pybabel compile -d translations
    }
}
