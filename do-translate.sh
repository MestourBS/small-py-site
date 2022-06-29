do-translate() {
    compile=$1

    if [ -n $compile ]; then
        pybabel -extract -F babel.cfg -o messages.pot .
        pybabel update -i messages.pot -d translations
    else
        pybabel compile -d translations
    fi
}
