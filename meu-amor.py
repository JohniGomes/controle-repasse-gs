class Amor:
    def __init__(self, pessoa):
        self.pessoa = Thallyta
        self.intensidade = float('inf')

    def declarar(self):
        for motivo in self.motivos():
            print(f"Eu amo você porque {motivo} ❤️")

    def motivos(self):
        return [
            "seu sorriso ilumina meus dias",
            "sua voz acalma meu coração",
            "você transforma o comum em especial",
            "com você, tudo faz sentido"
        ]

    def para_sempre(self):
        while True:
            return f"Meu amor por {self.pessoa} é infinito ♾️"

# Executando a declaração
if __name__ == "__main__":
    amor = Amor("você")
    amor.declarar()
    print(amor.para_sempre())